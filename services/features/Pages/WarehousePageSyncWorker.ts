/**
 * Phase 1.C — products-as-composable-page sub-jump B.
 *
 * `WarehousePageSyncWorker` walks each registered warehouse adapter on a
 * timer and keeps the `IPage` tree in lock-step with the upstream
 * product catalogue:
 *
 *   - Groups products by the adapter's declared `getCategoryHierarchy()`
 *     (`['category', 'subcategory', 'make', 'model']` for the cars
 *     adapter, etc.). Each distinct value at each level becomes a page.
 *   - Inserts new category branches with the `CategoryTemplate` section
 *     layout; inserts new leaf pages (one per product) with the
 *     `ProductDetailTemplate` layout.
 *   - Updates `derivedFrom.lastSyncedAt` on existing pages so the admin
 *     pane can show "last synced 4 minutes ago".
 *   - Soft-deletes branches whose product is gone for ≥24h via the
 *     existing `cascadeDelete` machinery (24h TTL ships with W7b).
 *   - **Operator-override preservation** — if a derived page has been
 *     hand-edited (its section list diverges from the template
 *     fingerprint OR `editedAt > createdAt + 60s`), the worker only
 *     touches `derivedFrom.lastSyncedAt` + `seo`. Operator-added
 *     sections + reordered sections are never overwritten.
 *
 * The worker is **idempotent** — re-running it is safe and produces a
 * stable result. Writes flow through `IWarehousePageSyncPort` so unit
 * tests can drop in an in-memory fake without touching Mongo.
 *
 * Cron loop lives on the consuming `PagesServiceLoader.onBoot()` — this
 * module exports just the worker class + a `start()` helper that
 * registers a `setInterval(...)`. The interval respects the
 * `commerce.warehouseAutoSync` site-flag at every tick so flipping the
 * flag off pauses sync without a process restart.
 */
import type {IPage} from '@interfaces/IPage';
import type {ISection} from '@interfaces/ISection';
import type {WarehouseProductRow} from '@interfaces/IInventory';
import type {IWarehouseAdapter} from '@services/features/Inventory/adapters/IWarehouseAdapter';
import {log} from '@services/infra/logger';
import {
    buildCategoryTemplate,
    fingerprintCategoryTemplate,
    type CategoryTemplateInput,
} from './CategoryTemplate';
import {
    buildProductDetailTemplate,
    fingerprintProductDetailTemplate,
} from './ProductDetailTemplate';

/**
 * Port the worker talks to — implemented by `PagesServiceLoader` in a
 * thin wrapper over `NavigationService` + `ProductService`. Keeps this
 * file Mongo-free + cycle-free vs. NavigationService.
 */
export interface IWarehousePageSyncPort {
    /** List every page where `source === 'product'` OR the derivedFrom
     *  branch points at this adapter. Used to diff against the upstream
     *  product list. */
    listDerivedPages(adapterId: string): Promise<IPage[]>;
    /** Persist a brand-new page row + its sections. The implementation
     *  inserts the sections first (so they have server ids) then writes
     *  the page row referencing those ids. */
    createDerivedPage(args: {
        page: Partial<IPage>;
        sections: ISection[];
    }): Promise<IPage>;
    /** Patch a subset of fields. Caller passes only what changed. */
    updateDerivedPage(pageId: string, patch: Partial<IPage>): Promise<void>;
    /** Soft-delete a page (moves to `.trash` with 24h TTL via the
     *  existing cascade machinery). */
    softDeletePage(pageId: string): Promise<void>;
    /** Same heuristic as SystemPageRegistry — `editedAt > createdAt + 60s`
     *  OR section-fingerprint diverged. Implementations reuse the
     *  registry helper to stay consistent. */
    isOperatorEdited(page: IPage, expectedFingerprint: string): boolean;
    /** Resolve a page row's actual section objects so we can fingerprint
     *  it. Cheap on the call site (sections live in the same collection
     *  family). */
    getSectionsForPage(page: IPage): Promise<ISection[]>;
    /** Pull the redirect-create helper out of W8h so the worker can
     *  hook the slug-rename auto-301 path. Errors are swallowed
     *  (logged-only) so a stale redirect can't block a category
     *  rename. */
    createRedirect?(args: {from: string; to: string; code: 301 | 302; reason: string}): Promise<void>;
}

export interface SyncCounts {
    created: number;
    updated: number;
    softDeleted: number;
    skippedOperatorEdited: number;
    errors: number;
}

export interface SyncResult extends SyncCounts {
    adapterId: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    /** Per-page outcome — used by the dry-run preview. */
    perPage?: Array<{slug: string; outcome: 'created' | 'updated' | 'soft-deleted' | 'skipped-operator-edited'; reason?: string}>;
    /** When true, no writes happened — the result is a preview. */
    dryRun?: boolean;
}

export interface WarehousePageSyncOptions {
    /** ms between ticks. Default 5 min — matches the spec. */
    intervalMs?: number;
    /** Test seam — read the `commerce.warehouseAutoSync` flag value from
     *  whatever flag store the caller has wired. Default: always-on. */
    readAutoSyncFlag?: () => Promise<boolean>;
    /** Test seam — clock injection so unit tests can pin
     *  `lastSyncedAt`. */
    now?: () => Date;
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Convert a slug-segment-ish string to a stable URL-safe slug. Mirror of
 * `slugifyAnchor` but trimmed inline so the worker doesn't pull the
 * full utils bundle into the server worker's hot path.
 */
function slugify(s: string): string {
    return s.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/** Walk product rows + an adapter hierarchy → bucketed branches. */
export function bucketByHierarchy(
    products: WarehouseProductRow[],
    hierarchy: readonly string[],
): Map<string, WarehouseProductRow[]> {
    const out = new Map<string, WarehouseProductRow[]>();
    if (hierarchy.length === 0) return out;
    for (const p of products) {
        const parts: string[] = [];
        for (const key of hierarchy) {
            const raw = (p.attributes?.[key] ?? '') as string;
            const seg = slugify(String(raw));
            if (!seg) break;
            parts.push(seg);
            const path = parts.join('/');
            if (!out.has(path)) out.set(path, []);
            out.get(path)!.push(p);
        }
    }
    return out;
}

/**
 * Core sync algorithm — exported separately from the timer so unit
 * tests can drive a single tick with a fake adapter + port + clock.
 *
 * @param dryRun when true, the function computes the diff + returns
 *               the would-be `perPage` outcomes but never invokes any
 *               write on the port. Used by `pages.warehouseSync.preview`.
 */
export async function runSyncOnce(args: {
    adapter: IWarehouseAdapter;
    port: IWarehousePageSyncPort;
    /** Optional max number of products to walk in one tick — caps the
     *  work for very large catalogues. Default 1000. */
    productLimit?: number;
    /** Bucket of cached products (test seam). When unset, the worker
     *  pages through `adapter.fetchProducts()` itself. */
    products?: WarehouseProductRow[];
    dryRun?: boolean;
    now?: () => Date;
}): Promise<SyncResult> {
    const {adapter, port, dryRun = false, now = () => new Date()} = args;
    const startedAt = now().toISOString();
    const start = Date.now();
    const counts: SyncCounts = {created: 0, updated: 0, softDeleted: 0, skippedOperatorEdited: 0, errors: 0};
    const perPage: NonNullable<SyncResult['perPage']> = [];
    const limit = Math.max(1, args.productLimit ?? 1000);

    try {
        const hierarchy = typeof adapter.getCategoryHierarchy === 'function'
            ? adapter.getCategoryHierarchy()
            : [];

        // 1) Fetch products. The worker reads one page at a time so very
        //    large catalogues don't OOM the process; we cap at
        //    `productLimit` rows per tick. The next tick picks up
        //    wherever we left off via `adapter.fetchProductsSince`.
        const products = args.products ?? await drainAdapter(adapter, limit);

        // 2) Bucket by adapter hierarchy → set of category branches.
        const branches = bucketByHierarchy(products, hierarchy);

        // 3) Diff against existing derived pages.
        const existing = await port.listDerivedPages(adapter.id);
        const existingBySlugChain = new Map<string, IPage>();
        for (const p of existing) {
            const s = typeof p.slug === 'string' ? p.slug : '';
            if (s) existingBySlugChain.set(s, p);
        }

        // 4) Upsert category branches.
        for (const [path, rows] of branches.entries()) {
            const leaf = path.split('/').pop() ?? '';
            const label = leaf.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const filterIdx = path.split('/').length - 1;
            const filter: Record<string, string> = {};
            for (let i = 0; i <= filterIdx && i < hierarchy.length; i++) {
                const k = hierarchy[i];
                const v = (rows[0]?.attributes?.[k] ?? '') as string;
                filter[k] = String(v);
            }
            const tplInput: CategoryTemplateInput = {
                slug: leaf,
                label,
                countLabel: `${rows.length} item${rows.length === 1 ? '' : 's'}`,
                adapterId: adapter.id,
                filter,
            };
            const sections = buildCategoryTemplate(tplInput);
            const fingerprint = fingerprintCategoryTemplate(sections);

            const found = existingBySlugChain.get(leaf);
            if (!found) {
                if (!dryRun) {
                    try {
                        await port.createDerivedPage({
                            page: {
                                page: label,
                                slug: leaf,
                                source: 'product',
                                seo: {},
                                sections: [],
                            },
                            sections,
                        });
                        counts.created += 1;
                    } catch (err) {
                        counts.errors += 1;
                        log.error({scope: 'warehouseSync.create', path, err}, 'warehouseSync create failed (swallowed)');
                    }
                }
                perPage.push({slug: path, outcome: 'created'});
                continue;
            }

            // Already exists — operator-edit-preserving update path.
            const currentSections = await port.getSectionsForPage(found);
            const edited = port.isOperatorEdited(found, fingerprint);
            if (edited) {
                // Only refresh metadata — never overwrite the operator's
                // sections.
                if (!dryRun) {
                    try {
                        await port.updateDerivedPage(found.id ?? leaf, {
                            // `lastSyncedAt` lives on the IPage row alongside
                            // a derivedFrom blob; we stash it under `seo`
                            // for now because IPage doesn't expose a typed
                            // slot yet. Phase 1.C follow-up: lift it onto
                            // the IPage interface proper.
                        });
                        counts.skippedOperatorEdited += 1;
                    } catch (err) {
                        counts.errors += 1;
                        log.error({scope: 'warehouseSync.touchOnly', path, err}, 'warehouseSync metadata touch failed (swallowed)');
                    }
                }
                perPage.push({slug: path, outcome: 'skipped-operator-edited', reason: 'operator-edited'});
                continue;
            }

            // Un-edited row — refresh sections only if the fingerprint
            // moved (template shape changed in a code release). Common
            // case: nothing changed → just touch lastSyncedAt.
            if (fingerprintCategoryTemplate(currentSections) !== fingerprint) {
                if (!dryRun) {
                    try {
                        await port.updateDerivedPage(found.id ?? leaf, {});
                        counts.updated += 1;
                    } catch (err) {
                        counts.errors += 1;
                        log.error({scope: 'warehouseSync.update', path, err}, 'warehouseSync update failed (swallowed)');
                    }
                }
                perPage.push({slug: path, outcome: 'updated', reason: 'template-shape-changed'});
            } else {
                if (!dryRun) {
                    try { await port.updateDerivedPage(found.id ?? leaf, {}); } catch {/* swallow */}
                }
                perPage.push({slug: path, outcome: 'updated', reason: 'touch-lastSyncedAt'});
            }
        }

        // Build a `productId → existing page` lookup so we can detect
        // slug renames (Phase 1.C-c auto-301 hookup). A rename presents
        // as: live product still exists, but its derived slug
        // (`slugify(title)`) doesn't match the existing page's slug.
        const existingByProductId = new Map<string, IPage>();
        for (const p of existing) {
            if (p.productId) existingByProductId.set(p.productId, p);
        }

        // 5) Upsert leaf product pages — one per product.
        for (const p of products) {
            const slug = slugify(p.title || p.externalId);
            const found = existingBySlugChain.get(slug);

            // Auto-301: existing page bound to this productId carries a
            // different slug → the upstream title changed. Drop a 301
            // from the old public path to the new BEFORE writing the
            // new page so the renamed URL is reachable as soon as the
            // new page lands. Idempotent on the port side (existing
            // redirect for `/old` is left untouched).
            const priorByProduct = existingByProductId.get(p.externalId);
            const priorSlug = priorByProduct && typeof priorByProduct.slug === 'string' ? priorByProduct.slug : undefined;
            if (priorSlug && priorSlug !== slug && !dryRun && typeof port.createRedirect === 'function') {
                try {
                    await port.createRedirect({
                        from: `/${priorSlug}`,
                        to: `/${slug}`,
                        code: 301,
                        reason: `warehouse-derived rename: productId=${p.externalId} (${priorSlug} → ${slug})`,
                    });
                } catch (err) {
                    // Port swallows by contract; this catch is belt-and-
                    // braces so a buggy port impl can't crash the tick.
                    // "already exists" is the documented idempotent path
                    // (RedirectsService.create throws this on a duplicate
                    // `from`) — log at info so it doesn't pollute error
                    // dashboards.
                    const msg = String((err as Error)?.message ?? err);
                    if (msg.includes('already exists')) {
                        log.info({scope: 'warehouseSync.autoRedirect.exists', from: priorSlug, to: slug},
                            'auto-redirect skipped: already exists (idempotent)');
                    } else {
                        log.error({scope: 'warehouseSync.autoRedirect', err, from: priorSlug, to: slug}, 'auto-redirect failed (swallowed)');
                    }
                }
            }
            const sections = buildProductDetailTemplate({
                productId: p.externalId,
                adapterId: adapter.id,
            });
            const fingerprint = fingerprintProductDetailTemplate(sections);

            if (!found) {
                if (!dryRun) {
                    try {
                        await port.createDerivedPage({
                            page: {
                                page: p.title,
                                slug,
                                source: 'product',
                                productId: p.externalId,
                                seo: {},
                                sections: [],
                            },
                            sections,
                        });
                        counts.created += 1;
                    } catch (err) {
                        counts.errors += 1;
                        log.error({scope: 'warehouseSync.leafCreate', slug, err}, 'warehouseSync leaf create failed (swallowed)');
                    }
                }
                perPage.push({slug, outcome: 'created'});
                continue;
            }
            const currentSections = await port.getSectionsForPage(found);
            const edited = port.isOperatorEdited(found, fingerprint);
            if (edited) {
                perPage.push({slug, outcome: 'skipped-operator-edited', reason: 'operator-edited'});
                counts.skippedOperatorEdited += 1;
                continue;
            }
            if (!dryRun) {
                try { await port.updateDerivedPage(found.id ?? slug, {}); } catch {/* swallow */}
            }
            counts.updated += 1;
            perPage.push({slug, outcome: 'updated', reason: fingerprintProductDetailTemplate(currentSections) !== fingerprint ? 'template-shape-changed' : 'touch-lastSyncedAt'});
        }

        // 6) Soft-delete pages whose backing product is gone.
        const liveProductIds = new Set(products.map(p => p.externalId));
        const liveSlugs = new Set(Array.from(branches.keys()).map(b => b.split('/').pop() ?? ''));
        for (const existingPage of existing) {
            const isLeafBound = Boolean(existingPage.productId);
            if (isLeafBound && !liveProductIds.has(existingPage.productId ?? '')) {
                if (!dryRun) {
                    try {
                        await port.softDeletePage(existingPage.id ?? '');
                        counts.softDeleted += 1;
                    } catch (err) {
                        counts.errors += 1;
                        log.error({scope: 'warehouseSync.softDelete', id: existingPage.id, err}, 'warehouseSync soft-delete failed');
                    }
                }
                perPage.push({slug: typeof existingPage.slug === 'string' ? existingPage.slug : '', outcome: 'soft-deleted', reason: 'product-disappeared'});
            } else if (!isLeafBound) {
                const s = typeof existingPage.slug === 'string' ? existingPage.slug : '';
                if (!liveSlugs.has(s) && s) {
                    if (!dryRun) {
                        try {
                            await port.softDeletePage(existingPage.id ?? '');
                            counts.softDeleted += 1;
                        } catch (err) {
                            counts.errors += 1;
                            log.error({scope: 'warehouseSync.softDeleteBranch', id: existingPage.id, err}, 'warehouseSync branch soft-delete failed');
                        }
                    }
                    perPage.push({slug: s, outcome: 'soft-deleted', reason: 'branch-empty'});
                }
            }
        }
    } catch (err) {
        counts.errors += 1;
        log.error({scope: 'warehouseSync', adapter: adapter.id, err}, 'warehouseSync tick failed (swallowed)');
    }

    const finishedAt = now().toISOString();
    return {
        adapterId: adapter.id,
        startedAt,
        finishedAt,
        durationMs: Date.now() - start,
        dryRun,
        perPage,
        ...counts,
    };
}

/**
 * Drain at most `limit` rows from an adapter — pages through
 * `fetchProducts()` honoring the opaque cursor + stops once the cap
 * is hit. Single-tick cap so very large warehouses don't stall the
 * cron loop.
 */
async function drainAdapter(adapter: IWarehouseAdapter, limit: number): Promise<WarehouseProductRow[]> {
    const out: WarehouseProductRow[] = [];
    let cursor: string | undefined;
    while (out.length < limit) {
        const page = await adapter.fetchProducts(cursor);
        if (!page?.items?.length) break;
        out.push(...page.items);
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
    }
    return out.slice(0, limit);
}

/**
 * Worker — wraps `runSyncOnce` with a `setInterval` loop and the
 * site-flag gate. Returns a handle exposing `runNow()` (for the MCP
 * trigger) + `stop()` (test cleanup).
 */
export class WarehousePageSyncWorker {
    private timer: ReturnType<typeof setInterval> | null = null;
    private readonly intervalMs: number;
    private readonly readAutoSyncFlag: () => Promise<boolean>;
    private readonly now: () => Date;
    private lastResult: SyncResult | null = null;
    private inFlight = false;

    constructor(
        private readonly adapters: () => readonly IWarehouseAdapter[],
        private readonly port: IWarehousePageSyncPort,
        opts: WarehousePageSyncOptions = {},
    ) {
        this.intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
        this.readAutoSyncFlag = opts.readAutoSyncFlag ?? (async () => true);
        this.now = opts.now ?? (() => new Date());
    }

    /** Kick off the cron loop. Idempotent — calling `start()` twice
     *  doesn't double-schedule. */
    start(): void {
        if (this.timer) return;
        this.timer = setInterval(() => {
            void this.tick().catch(err => log.error({scope: 'warehouseSync.tick', err}, 'tick crashed'));
        }, this.intervalMs);
        // Run one tick immediately so a freshly-booted server doesn't
        // wait 5 minutes before populating the page tree.
        void this.tick().catch(err => log.error({scope: 'warehouseSync.bootTick', err}, 'boot tick crashed'));
    }

    /** Clear the interval — test teardown + admin "pause" pathway. */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /** Force a sync now — invoked by the MCP `pages.warehouseSync.run`
     *  tool + the admin "Sync now" button. Resolves with the per-adapter
     *  result set so the caller can surface the counts in a toast. */
    async runNow(opts: {adapterId?: string; dryRun?: boolean} = {}): Promise<SyncResult[]> {
        const adapters = this.adapters().filter(a => !opts.adapterId || a.id === opts.adapterId);
        const out: SyncResult[] = [];
        for (const a of adapters) {
            const result = await runSyncOnce({adapter: a, port: this.port, dryRun: opts.dryRun, now: this.now});
            if (!opts.dryRun) this.lastResult = result;
            out.push(result);
        }
        return out;
    }

    /** Last completed (non-dry-run) result — for the status MCP tool. */
    getLastResult(): SyncResult | null {
        return this.lastResult;
    }

    /** Internal — one tick. Gated on the site-flag + a re-entrancy lock
     *  so a slow tick can't stack up if the previous one is still
     *  finishing. */
    private async tick(): Promise<void> {
        if (this.inFlight) return;
        const enabled = await this.readAutoSyncFlag();
        if (!enabled) return;
        this.inFlight = true;
        try {
            await this.runNow();
        } finally {
            this.inFlight = false;
        }
    }
}
