/**
 * `SsComCarsAdapter` — Wave 7b. Pulls used-car ads from ss.com cars
 * vertical, normalises them via `SsComCarsNormaliser`, and hands pages
 * back to `InventoryService`.
 *
 * Acquisition path is **path B (public RSS + paginated HTML crawl)**
 * — operator decision per spec. Real fetch is gated behind two env
 * vars so the merge is fixture-only by default:
 *
 *   SSCOM_FETCH_ENABLED=true   — explicit opt-in
 *   SSCOM_FETCH_URL=<rss-url>  — what to fetch
 *
 * Without both, the adapter reads from
 * `_fixtures/ss-com-sample.json`. Real-fetch path is rate-limited
 * (1 req/sec) and identifies itself in the `User-Agent`.
 *
 * See: docs/roadmap/storefront/ss-com-cars-integration.md
 */
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import type {IWarehouseAdapter} from './IWarehouseAdapter';
import type {FetchPage, HealthResult, WarehouseProductRow} from '@interfaces/IInventory';
import {normaliseAds, type SsComRawAd} from './SsComCarsNormaliser';

const FIXTURE_FILE = 'ss-com-sample.json';
const USER_AGENT = 'FunisimoBot/1.0 (+https://funisimo.pro/cars; warehouse-adapter)';
const MIN_INTERVAL_MS = 1000;

export interface SsComCarsAdapterOpts {
    /** Override fixture lookup — tests inject raw rows directly. */
    fixtureRaws?: SsComRawAd[];
    /** Override env-flag for tests. */
    fetchEnabled?: boolean;
    /** Override env-URL for tests. */
    fetchUrl?: string;
    /** Override rate-limit interval (ms). */
    minIntervalMs?: number;
    /** Inject a custom fetch (tests). */
    fetchImpl?: typeof fetch;
}

/**
 * Discriminated-union extension to `IAdapterConfig` lives in
 * `services/features/Inventory/adapters/index.ts` — kept off the
 * `shared/types` surface for now to avoid a cross-package change while
 * the adapter system is still settling.
 */
export interface SsComCarsConfig {
    kind: 'ss-com-cars';
    /** Force fixture even when env enables real-fetch. */
    forceFixture?: boolean;
}

export class SsComCarsAdapter implements IWarehouseAdapter {
    public readonly id = 'ss-com-cars';
    private readonly opts: SsComCarsAdapterOpts;
    private readonly cfg: SsComCarsConfig;
    private lastFetchAt = 0;

    constructor(cfg: SsComCarsConfig = {kind: 'ss-com-cars'}, opts: SsComCarsAdapterOpts = {}) {
        this.cfg = cfg;
        this.opts = opts;
    }

    /**
     * Phase 1.C — products-as-composable-page sub-jump B.
     *
     * The cars vertical has a stable 4-level taxonomy. The normaliser
     * stamps `category`, `subcategory`, `make`, `model` onto every row's
     * `attributes`; the `WarehousePageSyncWorker` consumes that hierarchy
     * to build `/products/cars/used/sedan/bmw/3-series/...` page trees.
     */
    getCategoryHierarchy(): readonly string[] {
        return ['category', 'subcategory', 'make', 'model'];
    }

    /** True iff both env flags are set AND the config doesn't force fixture. */
    private get realFetchEnabled(): boolean {
        if (this.cfg.forceFixture) return false;
        const enabled = this.opts.fetchEnabled
            ?? (process.env.SSCOM_FETCH_ENABLED === 'true');
        const url = this.opts.fetchUrl ?? process.env.SSCOM_FETCH_URL ?? '';
        return Boolean(enabled && url);
    }

    async healthCheck(): Promise<HealthResult> {
        const start = Date.now();
        // Fixture mode is always healthy as long as the file parses.
        if (!this.realFetchEnabled) {
            try {
                await this.loadFixtureRaws();
                return {ok: true, latencyMs: Date.now() - start, adapter: this.id, message: 'fixture mode'};
            } catch (err) {
                return {ok: false, latencyMs: Date.now() - start, adapter: this.id, message: `fixture load failed: ${(err as Error).message}`};
            }
        }
        // Real fetch — HEAD the configured URL.
        try {
            const url = this.opts.fetchUrl ?? process.env.SSCOM_FETCH_URL!;
            const f = this.opts.fetchImpl ?? fetch;
            const res = await f(url, {method: 'HEAD', headers: {'user-agent': USER_AGENT}});
            return {
                ok: res.ok || res.status === 405,
                latencyMs: Date.now() - start,
                adapter: this.id,
                message: res.ok ? undefined : `HTTP ${res.status}`,
            };
        } catch (err) {
            return {ok: false, latencyMs: Date.now() - start, adapter: this.id, message: String((err as Error).message || err)};
        }
    }

    /**
     * One page == all fixture rows (small fixture set). Real-fetch
     * mode produces a single page from the RSS response. Pagination
     * is intentionally a no-op v1 — ss.com RSS caps at ~50 entries
     * per feed and we drain it whole.
     */
    async fetchProducts(cursor?: string): Promise<FetchPage> {
        if (cursor) {
            // We always return `nextCursor: null` so any non-null cursor
            // is a caller bug; honour it by emitting an empty page so
            // the run terminates cleanly.
            return {items: [], nextCursor: null};
        }
        const raws = this.realFetchEnabled
            ? await this.realFetchRaws()
            : await this.loadFixtureRaws();
        const items: WarehouseProductRow[] = normaliseAds(raws);
        return {items, nextCursor: null};
    }

    // -----------------------------------------------------------------
    // Fixture loading
    // -----------------------------------------------------------------

    private async loadFixtureRaws(): Promise<SsComRawAd[]> {
        if (this.opts.fixtureRaws) return this.opts.fixtureRaws;
        const path = resolveFixturePath();
        const body = await readFile(path, 'utf8');
        const parsed = JSON.parse(body) as {items?: SsComRawAd[]};
        if (!parsed || !Array.isArray(parsed.items)) return [];
        return parsed.items;
    }

    // -----------------------------------------------------------------
    // Real fetch (env-gated). Treated as operator-enabled post-merge —
    // ships disabled. Keeps the wire-format coupling shallow: pulls the
    // RSS feed, treats each entry as an `SsComRawAd`. Operator decides
    // the URL.
    // -----------------------------------------------------------------

    private async realFetchRaws(): Promise<SsComRawAd[]> {
        await this.respectRateLimit();
        const url = this.opts.fetchUrl ?? process.env.SSCOM_FETCH_URL!;
        const f = this.opts.fetchImpl ?? fetch;
        const res = await f(url, {
            method: 'GET',
            headers: {
                'user-agent': USER_AGENT,
                'accept': 'application/rss+xml, application/xml, text/html;q=0.5',
            },
        });
        if (!res.ok) {
            throw new Error(`SsComCarsAdapter: HTTP ${res.status} fetching ${url}`);
        }
        const body = await res.text();
        // RSS or HTML — both are out of scope to fully parse here.
        // We accept JSON-shaped responses (e.g. an operator proxy that
        // already converted) verbatim; anything else returns empty +
        // surfaces the wire format in the run errors via the dead-letter
        // queue when InventoryService rejects the empty page.
        try {
            const parsed = JSON.parse(body);
            if (Array.isArray(parsed)) return parsed as SsComRawAd[];
            if (parsed && Array.isArray(parsed.items)) return parsed.items as SsComRawAd[];
        } catch { /* fall through */ }
        // TODO(post-merge ops): wire a cheerio-backed RSS/HTML parser
        // when the operator turns the env-flag on. Until then real-fetch
        // mode is documented as "fixture-only" + "JSON-proxy supported".
        return [];
    }

    private async respectRateLimit(): Promise<void> {
        const min = this.opts.minIntervalMs ?? MIN_INTERVAL_MS;
        const elapsed = Date.now() - this.lastFetchAt;
        if (elapsed < min) {
            await new Promise(r => setTimeout(r, min - elapsed));
        }
        this.lastFetchAt = Date.now();
    }
}

/** Resolve `_fixtures/ss-com-sample.json` relative to this module —
 *  works in both CJS (`__dirname`) and ESM (`import.meta.url`) builds. */
function resolveFixturePath(): string {
    // Prefer `__dirname` when present (CJS / ts-node); fall back to ESM
    // URL resolution. The try/catch keeps both branches buildable in
    // the same TS config without `import.meta` errors on CJS.
    try {
         
        const dn: string | undefined = (globalThis as any).__dirname ?? (typeof __dirname !== 'undefined' ? __dirname : undefined);
        if (dn) return join(dn, '_fixtures', FIXTURE_FILE);
    } catch { /* noop */ }
    try {
         
        const meta = (eval('import.meta')) as {url: string};
        return join(dirname(fileURLToPath(meta.url)), '_fixtures', FIXTURE_FILE);
    } catch {
        return join(process.cwd(), 'services', 'features', 'Inventory', 'adapters', '_fixtures', FIXTURE_FILE);
    }
}
