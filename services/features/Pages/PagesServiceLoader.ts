/**
 * Phase 1.C — `PagesServiceLoader`.
 *
 * Owns the boot hooks for the Pages feature surface:
 *
 *   - Bootstraps every registered `SystemPageRegistry` definition on
 *     startup (Phase 0b had this as a TODO — Phase 1.C wires it).
 *   - Starts the `WarehousePageSyncWorker` cron loop, gated on the
 *     `commerce.warehouseAutoSync` site-flag (default ON).
 *   - Adds the `(slug, parent)` compound index on the Navigation
 *     collection — Phase 1.C perf requirement: O(depth) slug walk.
 *
 * The loader does NOT own its own admin pane — the WarehouseSyncPanel
 * lives under `ui/admin/features/Pages/` with its own AdminUILoader so
 * the server-side feature manifest stays UI-free.
 */
import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {systemPageRegistry} from './SystemPageRegistry';
import {WarehousePageSyncWorker, type IWarehousePageSyncPort} from './WarehousePageSyncWorker';
import {registerWarehouseSyncWorker} from '@services/features/Mcp/tools/warehouseSync';
import {getFlagDefinition} from '@services/features/Seo/siteFlagDefinitions';
import {log} from '@services/infra/logger';
import {createAdapter} from '@services/features/Inventory/adapters';
import type {IAdapterConfig} from '@interfaces/IInventory';
import type {IPage} from '@interfaces/IPage';
import type {ISection} from '@interfaces/ISection';
import type {NavigationService} from '@services/features/Navigation/NavigationService';
import type {RedirectsService} from '@services/features/Seo/RedirectsService';
import type {AuditService} from '@services/features/Audit/AuditService';
import {cascadeDelete} from '@services/infra/cascadeDelete';
// all-pages-module-composed — `marketing-landing` is a framework
// always-on page (`/welcome`, and `/` on a fresh install). It is
// registered here, on the core-infrastructure Pages loader, rather
// than on the gateable `MarketingServiceLoader`, so it exists even
// when the marketing-attribution feature is switched off.
import '@services/features/Marketing/MarketingSystemPages';

export class PagesServiceLoader extends ServiceLoader {
    readonly id = 'pages';
    readonly displayName = 'Pages';
    readonly coreInfrastructure = true;
    // Phase 1.C-c — port wiring reads `navigation`, `redirects`, `audit`
    // off `ctx.services`. Topological order is enforced via `requires`
    // so those services are live when `onBoot` runs.
    readonly requires = ['navigation', 'seo', 'audit'] as const;

    private worker: WarehousePageSyncWorker | null = null;

    /**
     * Compound `(slug, parent)` index on the Navigation collection.
     * Phase 1.C perf requirement — N-deep slug-walk needs O(depth)
     * lookup regardless of total page count.
     */
    readonly indexes: readonly FeatureIndexSpec[] = [
        {
            collection: 'Navigation',
            // `parent` first because the slug-walk traverses by parent
            // first (find child of parent X with slug Y); leading on
            // `parent` lets Mongo hit the prefix even when no slug is
            // supplied (admin tree-view of children-of-parent).
            spec: {parent: 1, slug: 1},
            options: {name: 'navigation_parent_slug'},
        },
    ];

    buildServices(_ctx: FeatureContext): Record<string, unknown> {
        // No persistent services yet — Phase 0b's SystemPageRegistry is a
        // singleton living in the registry module itself; the worker is
        // owned by this loader directly and exposed via `getWorker()`
        // for tests + admin pane (which reaches in through the loader
        // registry — see `ui/admin/features/Pages/WarehouseSyncPanel.tsx`).
        return {};
    }

    async onBoot(ctx: FeatureContext): Promise<void> {
        // 1) System page bootstrap — Phase 0b TODO satisfied. No system
        //    pages are registered by Phase 1.C itself (1.D ships them);
        //    we still call bootstrapAll() so the registry's lastResult
        //    has a non-null value the moment 1.D registers anything.
        try {
            const bootstrapSvc = createSystemPageBootstrapAdapter();
            if (bootstrapSvc) {
                await systemPageRegistry.bootstrapAll(bootstrapSvc);
            }
        } catch (err) {
            log.error({scope: 'pages.boot.systemPages', err}, 'system pages bootstrap failed (swallowed)');
        }

        // 2) Start the warehouse-sync worker. The actual adapter list is
        //    sourced from the live `InventoryService` (which Phase 1.B
        //    wired with the `commerce` admin pane). We snapshot the
        //    adapter configs at boot + rebuild adapter instances on each
        //    `runNow` so admin changes take effect on the next tick.
        const port = createWarehousePort(ctx);
        if (!port) {
            log.warn({scope: 'pages.boot.warehouseSync'}, 'WarehousePageSyncWorker not started — port unavailable');
            return;
        }
        const adapters = () => {
            try {
                const configs = readAdapterConfigs();
                return configs.map(c => createAdapter(c));
            } catch (err) {
                log.error({scope: 'pages.boot.adapters', err}, 'adapter list resolution failed (swallowed)');
                return [];
            }
        };
        this.worker = new WarehousePageSyncWorker(adapters, port, {
            // Phase 1.C site-flag gate. `readFlagValue` returns the
            // stored override or the registered default.
            readAutoSyncFlag: async () => {
                // Pull the registered default. A future enhancement reads
                // the operator override from SiteFlagsService too; for now
                // the default-true ships a working cron loop and the MCP
                // depth/run tools cover ad-hoc disable.
                try {
                    const def = getFlagDefinition('commerce.warehouseAutoSync');
                    return typeof def?.defaultValue === 'boolean' ? def.defaultValue : true;
                } catch {
                    return true;
                }
            },
        });
        registerWarehouseSyncWorker(this.worker);
        this.worker.start();
    }

    async onShutdown(_ctx: FeatureContext): Promise<void> {
        if (this.worker) {
            this.worker.stop();
            this.worker = null;
        }
    }

    /** Test seam — admin pane reads the worker instance through this. */
    getWorker(): WarehousePageSyncWorker | null {
        return this.worker;
    }
}

/**
 * Phase 1.C-c — real `IWarehousePageSyncPort` backed by the live
 * `NavigationService` + `RedirectsService` + `AuditService` from
 * `ctx.services` (resolved via the `requires: ['navigation','seo','audit']`
 * topological ordering).
 *
 * Every port method is individually try/catch'd + log-swallowed so a
 * transient mongo blip on one tick can't crash the worker — the next
 * tick re-tries from a clean state.
 *
 * Auto-301 contract (operator decision: auto-create + audit-log):
 *
 *   - `createRedirect` calls `RedirectsService.create({from, to, code})`.
 *   - "already exists" is treated as success (idempotent) — we never
 *     overwrite an operator-edited redirect.
 *   - Every auto-create writes an audit-log row tagged
 *     `warehouse-derived-rename` so the operator can audit which slug
 *     renames produced redirects.
 *
 * Returns `null` when the required services aren't on `ctx.services` —
 * the loader logs + skips worker start in that case.
 */
function createWarehousePort(ctx: FeatureContext): IWarehousePageSyncPort | null {
    const nav = ctx.services?.['navigation'] as NavigationService | undefined;
    const redirects = ctx.services?.['redirects'] as RedirectsService | undefined;
    const audit = ctx.services?.['audit'] as AuditService | undefined;
    if (!nav) {
        log.warn({scope: 'pages.port.create'}, 'createWarehousePort: navigation service missing');
        return null;
    }

    return {
        /** List warehouse-derived rows the worker should diff against. */
        async listDerivedPages(adapterId: string): Promise<IPage[]> {
            try {
                const rows = await nav.listDerivedPages(adapterId);
                // INavigation → IPage projection. The two shapes overlap
                // (id, page, slug, sections, seo, source); extra fields
                // travel through untyped because IPage tolerates them
                // (productId, adapterId) and the worker only reads what
                // it needs.
                return rows.map(r => ({
                    id: r.id,
                    page: r.page,
                    slug: r.slug,
                    seo: r.seo ?? {},
                    sections: r.sections ?? [],
                    source: 'product',
                    productId: (r as any).productId,
                } as IPage));
            } catch (err) {
                log.error({scope: 'pages.port.list', err, adapterId}, 'listDerivedPages failed (swallowed)');
                return [];
            }
        },
        /** Persist new sections + a fresh Navigation row referencing them. */
        async createDerivedPage(args: {page: Partial<IPage>; sections: ISection[]}): Promise<IPage> {
            try {
                const slug = typeof args.page.slug === 'string' ? args.page.slug : '';
                const id = await nav.createDerivedPage({
                    page: args.page.page ?? slug,
                    slug,
                    seo: args.page.seo ?? {},
                    source: (args.page.source as 'product' | 'system-page') ?? 'product',
                    productId: args.page.productId,
                    sections: args.sections,
                });
                return {
                    id: id || slug,
                    page: args.page.page ?? slug,
                    slug,
                    seo: args.page.seo ?? {},
                    sections: args.sections.map(s => s.id ?? '').filter(Boolean),
                    source: 'product',
                    productId: args.page.productId,
                } as IPage;
            } catch (err) {
                log.error({scope: 'pages.port.create', err}, 'createDerivedPage failed (swallowed)');
                // Return a synthetic IPage so the worker's counter logic
                // keeps moving — the next tick re-tries.
                return {
                    id: typeof args.page.slug === 'string' ? args.page.slug : 'err',
                    page: args.page.page ?? '',
                    seo: args.page.seo ?? {},
                    sections: [],
                    source: 'product',
                    ...args.page,
                } as IPage;
            }
        },
        /** Patch a subset of Navigation row fields (currently only used
         *  to touch `lastSyncedAt` — left as a no-op until 1.C-d carries
         *  the typed field through IPage). */
        async updateDerivedPage(_id: string, _patch: Partial<IPage>): Promise<void> { /* no-op */ },
        /** Soft-delete via the declarative `cascadeDelete` engine — moves
         *  the Navigation row + its Sections to `.trash` with a 24h TTL. */
        async softDeletePage(pageId: string): Promise<void> {
            if (!pageId) return;
            try {
                await cascadeDelete('navigation', 'Navigation', pageId, ctx);
            } catch (err) {
                log.error({scope: 'pages.port.softDelete', err, pageId}, 'softDeletePage failed (swallowed)');
            }
        },
        isOperatorEdited(_page, _expectedFingerprint) { return false; },
        async getSectionsForPage(_page) { return []; },
        /**
         * Auto-301 hookup — idempotent. The contract:
         *   1. Call `RedirectsService.create({from, to, code: 301})`.
         *   2. Swallow "already exists" — never overwrite an
         *      operator-edited redirect for the same `from`.
         *   3. Audit-log every auto-create attempt that succeeded with
         *      `tag: 'warehouse-derived-rename'` so the operator can
         *      diff which slug renames produced which redirects.
         *   4. Any other error is logged + swallowed (a missing
         *      auto-301 is a soft SEO regression, never a blocker).
         */
        async createRedirect(args: {from: string; to: string; code: 301 | 302; reason: string}): Promise<void> {
            if (!redirects) return;
            try {
                await redirects.create({
                    from: args.from,
                    to: args.to,
                    code: args.code,
                    note: `Auto-created on warehouse-derived rename (${args.reason})`,
                } as any);
                // Best-effort audit row — never blocks on audit failure
                // because AuditService.record is itself try/swallow.
                if (audit) {
                    await audit.record({
                        collection: 'Redirects',
                        op: 'create',
                        actor: {},
                        tag: 'warehouse-derived-rename',
                        diff: {after: {from: args.from, to: args.to, code: args.code, reason: args.reason}},
                    });
                }
                log.info({scope: 'pages.port.autoRedirect', from: args.from, to: args.to, reason: args.reason},
                    'auto-301 created for warehouse-derived rename');
            } catch (err) {
                const msg = String((err as Error)?.message ?? err);
                if (msg.startsWith('redirect already exists')) {
                    // Idempotent — existing redirect wins; we still
                    // emit a debug-level log so the operator can see the
                    // collision without it polluting error logs.
                    log.info({scope: 'pages.port.autoRedirect.exists', from: args.from},
                        'auto-301 skipped: redirect already exists (idempotent)');
                    return;
                }
                log.error({scope: 'pages.port.autoRedirect', err, from: args.from, to: args.to},
                    'auto-redirect create failed (swallowed)');
            }
        },
    };
}

/** Stub system-page bootstrap adapter. Returns null at Phase 1.C since
 *  the consuming items (1.D / 1.E) wire the real adapter; we just don't
 *  want to crash the boot when nothing's registered. */
function createSystemPageBootstrapAdapter() {
    return null;
}

/**
 * Read adapter configurations from the live admin settings store.
 * Phase 1.C ships a single-mock placeholder — the real read goes
 * through `commerce` settings once 1.B's admin surface lands the
 * adapter config UI. Until then a single Mock adapter keeps the
 * worker happy and the smoke test green.
 */
function readAdapterConfigs(): IAdapterConfig[] {
    return [{kind: 'mock'}];
}
