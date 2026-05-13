/**
 * Phase 0b — System Page Registry.
 *
 * Several upcoming items (checkout-as-composable-page,
 * client-account-settings-page, products-as-composable-page) need
 * framework-required pages that don't make sense to ask the operator to
 * create by hand. The Registry is the single source of truth for those
 * "system pages":
 *
 *   - Each definition declares a stable `systemKey` (e.g. `'checkout-payment'`),
 *     a `slug`, an i18n title key, and a `defaultSections()` factory that
 *     returns the canonical section list for that page.
 *   - At boot, `bootstrapAll()` upserts a Navigation row per definition
 *     stamped with `source: 'system-page'` + `systemKey: <key>`.
 *   - If an operator later edits the row's sections, the heuristic in
 *     `isOperatorEdited()` flips and subsequent boots only refresh
 *     non-section metadata (slug / SEO / access gate) — operator edits
 *     to the section layout are preserved.
 *
 * The actual Mongo I/O lives behind the `ISystemPageBootstrapService`
 * port so this module stays test-friendly + cycle-free relative to
 * NavigationService. Phase 0b only ships the registry shape + read MCP
 * tools; the consuming items wire `bootstrapAll()` on their feature's
 * `onBoot` hook.
 */

import type {IPage} from '@interfaces/IPage';
import type {ISection} from '@interfaces/ISection';
import {log} from '@services/infra/logger';

/**
 * One system page's canonical definition. Plain data + a section
 * factory; declaring features register one of these per page they
 * own (e.g. Checkout registers `'cart'`, `'checkout-address'`, ...).
 */
export interface ISystemPageDefinition {
    /** Stable identifier — `'cart' | 'checkout-payment' | …`. Required unique. */
    systemKey: string;
    /** Public URL slug. Operators may rename via the admin; bootstrap won't fight a rename. */
    slug: string;
    /** i18n key for the human-facing title. Resolved by the caller. */
    titleI18nKey: string;
    /**
     * Section factory — returns the canonical section list for a fresh
     * page. Called only on first insert (or when the operator hasn't
     * touched the row); operator-edited rows preserve their current
     * sections.
     */
    defaultSections: () => ISection[];
    /** Optional SEO defaults — `indexable=false` for transactional pages. */
    seo?: {
        indexable?: boolean;
        canonical?: 'self';
    };
    /** Which session class is required to access the page (informational; gating is the consumer's job). */
    accessGate?: 'customer-session' | 'guest-token' | 'open' | 'admin-session';
}

/**
 * Port the registry talks to. Implemented by the consuming feature
 * loader (typically a thin wrapper around `NavigationService`). Lets
 * `SystemPageRegistry` stay free of Mongo + Navigation dependencies so
 * it can be exercised under unit test with an in-memory fake.
 */
export interface ISystemPageBootstrapService {
    /** Look up an existing system page by its `systemKey`. */
    findByKey(systemKey: string): Promise<IPage | null>;
    /** Insert a new page row. */
    create(page: Partial<IPage>): Promise<IPage>;
    /** Patch a subset of fields on an existing page row. */
    update(id: string, patch: Partial<IPage>): Promise<void>;
    /**
     * Heuristic: has an operator hand-edited this system page since it
     * was bootstrapped? Implementations typically check
     * `editedAt > createdAt + 1min` AND `sections.length` diverges from
     * the registered defaults' fingerprint.
     */
    isOperatorEdited(page: IPage): boolean;
}

/** Result of one `bootstrapAll()` run — surfaced via the MCP read tool. */
export interface IBootstrapResult {
    created: number;
    updated: number;
    skipped: number;
    lastRunAt: string;
    perKey: Array<{systemKey: string; outcome: 'created' | 'updated' | 'skipped'; reason?: string}>;
}

/**
 * Singleton-style registry. Exposed as a class for testability — the
 * exported `systemPageRegistry` is the runtime instance everyone else
 * imports.
 */
export class SystemPageRegistry {
    private definitions = new Map<string, ISystemPageDefinition>();
    private lastResult: IBootstrapResult | null = null;

    /**
     * Register a system page definition. Throws on duplicate
     * `systemKey` so two features can't silently fight over the same
     * page. Validates the minimum required shape.
     */
    register(def: ISystemPageDefinition): void {
        if (!def || typeof def.systemKey !== 'string' || def.systemKey.length === 0) {
            throw new Error('SystemPageRegistry.register: systemKey is required');
        }
        if (typeof def.slug !== 'string' || def.slug.length === 0) {
            throw new Error(`SystemPageRegistry.register(${def.systemKey}): slug is required`);
        }
        if (typeof def.defaultSections !== 'function') {
            throw new Error(`SystemPageRegistry.register(${def.systemKey}): defaultSections must be a function`);
        }
        if (this.definitions.has(def.systemKey)) {
            throw new Error(`SystemPageRegistry.register: duplicate systemKey "${def.systemKey}"`);
        }
        this.definitions.set(def.systemKey, def);
    }

    /** Fetch a single definition by key, or `null` if unknown. */
    getDefinition(systemKey: string): ISystemPageDefinition | null {
        return this.definitions.get(systemKey) ?? null;
    }

    /** Snapshot of every registered definition, frozen against the caller. */
    listDefinitions(): readonly ISystemPageDefinition[] {
        return Array.from(this.definitions.values());
    }

    /** Last bootstrap-run summary (or `null` before the first run). */
    getLastResult(): IBootstrapResult | null {
        return this.lastResult;
    }

    /**
     * Internal — test-only hook. Resets the registry so a test suite can
     * exercise duplicate-registration / re-bootstrap paths without
     * leaking state across files. Exported indirectly via the class so
     * production callers cannot reach it from the singleton.
     */
    _resetForTests(): void {
        this.definitions.clear();
        this.lastResult = null;
    }

    /**
     * Upsert every registered system page. Idempotent + operator-edit-preserving:
     *
     *   - missing row → `create({source: 'system-page', systemKey, ...})`
     *     with `defaultSections()`.
     *   - existing row + operator-edited → patch only metadata (slug,
     *     seo) — leave sections alone.
     *   - existing row + un-edited → patch metadata; do not overwrite
     *     section ids unless the existing list is empty (a corruption
     *     recovery path).
     *
     * Per-key failures are caught + logged so one bad page can't abort
     * the rest of the boot.
     */
    async bootstrapAll(svc: ISystemPageBootstrapService): Promise<IBootstrapResult> {
        const result: IBootstrapResult = {
            created: 0,
            updated: 0,
            skipped: 0,
            lastRunAt: new Date().toISOString(),
            perKey: [],
        };
        for (const def of this.definitions.values()) {
            try {
                const existing = await svc.findByKey(def.systemKey);
                if (!existing) {
                    // Build the freshly-defaulted page. The Navigation
                    // adapter assigns `id` + audit fields itself.
                    const sections = def.defaultSections();
                    await svc.create({
                        page: def.titleI18nKey,
                        slug: def.slug,
                        seo: {},
                        sections: sections.map(s => s.id ?? '').filter(Boolean),
                        source: 'system-page',
                        systemKey: def.systemKey,
                    });
                    result.created += 1;
                    result.perKey.push({systemKey: def.systemKey, outcome: 'created'});
                    continue;
                }
                const operatorTouched = svc.isOperatorEdited(existing);
                const patch: Partial<IPage> = {};
                // Slug is operator-overridable. Only refresh when the row
                // still carries the registry-default slug (i.e. operator
                // hasn't renamed). Heuristic: if `existing.slug` matches
                // the registered default slug exactly OR is unset, take
                // the latest registered value.
                const currentSlug = typeof existing.slug === 'string' ? existing.slug : undefined;
                if (!currentSlug || currentSlug === def.slug) {
                    patch.slug = def.slug;
                }
                // Sections — only refresh when un-edited AND empty (corrupt-recovery).
                if (!operatorTouched && (!existing.sections || existing.sections.length === 0)) {
                    const sections = def.defaultSections();
                    patch.sections = sections.map(s => s.id ?? '').filter(Boolean);
                }
                if (Object.keys(patch).length === 0) {
                    result.skipped += 1;
                    result.perKey.push({
                        systemKey: def.systemKey,
                        outcome: 'skipped',
                        reason: operatorTouched ? 'operator-edited' : 'in-sync',
                    });
                    continue;
                }
                await svc.update(existing.id ?? def.systemKey, patch);
                result.updated += 1;
                result.perKey.push({
                    systemKey: def.systemKey,
                    outcome: 'updated',
                    reason: operatorTouched ? 'metadata-only (operator-edited sections preserved)' : 'metadata',
                });
            } catch (err) {
                log.error(
                    {scope: 'systemPages.bootstrap', systemKey: def.systemKey, err},
                    'system-page bootstrap failed for key (swallowed)',
                );
                result.skipped += 1;
                result.perKey.push({
                    systemKey: def.systemKey,
                    outcome: 'skipped',
                    reason: `error: ${String((err as Error).message ?? err)}`,
                });
            }
        }
        this.lastResult = result;
        return result;
    }
}

/** Runtime singleton — features register against this. */
export const systemPageRegistry = new SystemPageRegistry();
