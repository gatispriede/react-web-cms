import type {IWarehouseAdapter} from './IWarehouseAdapter';
import type {FetchPage, HealthResult, WarehouseProductRow, GenericFeedConfig} from '@interfaces/IInventory';

/**
 * Catch-all "we have a URL that returns the catalogue" adapter. See the
 * spec at docs/features/inventory-warehouse.md §2 (`GenericFeedAdapter`).
 *
 * Auto-detects payload shape from `Content-Type`:
 *   - JSON array       — body starts with `[`, each element = one product
 *   - JSON object      — body starts with `{`, follow `itemsPath` or
 *                        auto-detect the longest array property
 *   - NDJSON / JSONL   — `application/x-ndjson` / `application/jsonl`
 *   - CSV / TSV        — header row required; delimiter auto-detected
 *
 * Field mapping is JSONPath-ish: top-level keys, dot-separated. Full
 * JSONPath bracket / wildcard syntax is intentionally NOT supported —
 * the operator can pre-flatten or write a small enrichment layer.
 *
 * DECISION: use Node's built-in `fetch` (Node 22) — no new dep.
 */

// DECISION: per-call cache of `lastEtag` / `lastModified` is owned by
// `InventoryService` (persisted on the run doc) — passing through opts
// keeps the adapter pure and re-constructable.
export interface GenericFeedFetchOpts {
    ifNoneMatch?: string;
    ifModifiedSince?: string;
    /** When the response carries validators, the adapter writes them
     *  here so the caller can persist for the next run. */
    sink?: {etag?: string; lastModified?: string};
}

const DEFAULT_PAGE_LIMIT = 200;

export class GenericFeedAdapter implements IWarehouseAdapter {
    public readonly id = 'generic-feed';
    private fetchOpts: GenericFeedFetchOpts | undefined;

    constructor(private cfg: GenericFeedConfig) {
        if (!cfg?.url) throw new Error('GenericFeedAdapter: url is required');
    }

    /** Caller (InventoryService) may pass conditional-GET hints + a sink
     *  to capture the response validators. The adapter consumes them on
     *  the next `fetchProducts`. */
    withFetchOpts(opts: GenericFeedFetchOpts | undefined): this {
        this.fetchOpts = opts;
        return this;
    }

    async healthCheck(): Promise<HealthResult> {
        const start = Date.now();
        try {
            const ctl = new AbortController();
            const timer = setTimeout(() => ctl.abort(), 5000);
            try {
                const res = await fetch(this.cfg.url, {
                    method: 'HEAD',
                    headers: this.authHeaders(),
                    signal: ctl.signal,
                });
                if (!res.ok && res.status !== 405) {
                    return {ok: false, latencyMs: Date.now() - start, adapter: this.id, message: `HTTP ${res.status}`};
                }
                // 405 (Method Not Allowed) on HEAD is common — fall through to GET.
                if (res.status === 405) {
                    const r2 = await fetch(this.cfg.url, {method: 'GET', headers: this.authHeaders(), signal: ctl.signal});
                    return {
                        ok: r2.ok,
                        latencyMs: Date.now() - start,
                        adapter: this.id,
                        message: r2.ok ? undefined : `HTTP ${r2.status}`,
                    };
                }
                return {ok: true, latencyMs: Date.now() - start, adapter: this.id};
            } finally {
                clearTimeout(timer);
            }
        } catch (err) {
            return {ok: false, latencyMs: Date.now() - start, adapter: this.id, message: String((err as Error).message || err)};
        }
    }

    async fetchProducts(cursor?: string): Promise<FetchPage> {
        const url = this.buildUrl(cursor);
        const headers = this.authHeaders();
        if (this.fetchOpts?.ifNoneMatch) headers['If-None-Match'] = this.fetchOpts.ifNoneMatch;
        if (this.fetchOpts?.ifModifiedSince) headers['If-Modified-Since'] = this.fetchOpts.ifModifiedSince;
        const res = await fetch(url, {method: 'GET', headers});
        if (res.status === 304) {
            return {items: [], nextCursor: null};
        }
        if (!res.ok) {
            throw new Error(`GenericFeedAdapter: HTTP ${res.status} fetching ${url}`);
        }
        // Capture validators for the next run.
        const sink = this.fetchOpts?.sink;
        if (sink) {
            const etag = res.headers.get('etag');
            const lm = res.headers.get('last-modified');
            if (etag) sink.etag = etag;
            if (lm) sink.lastModified = lm;
        }
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        const body = await res.text();
        const items = this.parseBody(body, ct);
        const nextCursor = this.computeNextCursor(res, body, cursor, items);
        return {items, nextCursor};
    }

    // -----------------------------------------------------------------
    // URL / pagination construction
    // -----------------------------------------------------------------

    private buildUrl(cursor: string | undefined): string {
        const pag = this.cfg.pagination;
        if (!pag || pag.kind === 'none') return this.cfg.url;
        if (pag.kind === 'link-header') {
            // Cursor for link-header pagination is the next URL itself.
            return cursor || this.cfg.url;
        }
        const u = new URL(this.cfg.url);
        if (pag.kind === 'cursor') {
            if (cursor) u.searchParams.set(pag.cursorParam, cursor);
            return u.toString();
        }
        if (pag.kind === 'page') {
            const start = pag.pageStart ?? 1;
            const page = cursor ? Number(cursor) : start;
            u.searchParams.set(pag.pageParam, String(page));
            return u.toString();
        }
        if (pag.kind === 'offset') {
            const off = cursor ? Number(cursor) : 0;
            u.searchParams.set(pag.offsetParam, String(off));
            u.searchParams.set(pag.limitParam, String(pag.limit));
            return u.toString();
        }
        return this.cfg.url;
    }

    private computeNextCursor(res: Response, body: string, cursor: string | undefined, items: WarehouseProductRow[]): string | null {
        const pag = this.cfg.pagination;
        if (!pag || pag.kind === 'none') return null;
        if (pag.kind === 'link-header') {
            const link = res.headers.get('link');
            if (!link) return null;
            const match = link.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
            return match ? match[1] : null;
        }
        if (pag.kind === 'cursor') {
            // Body is JSON for cursor-style APIs (rare otherwise) — sniff.
            try {
                const parsed = JSON.parse(body);
                const next = getByPath(parsed, pag.cursorPath);
                if (typeof next === 'string' && next) return next;
                if (typeof next === 'number') return String(next);
                return null;
            } catch {
                return null;
            }
        }
        if (pag.kind === 'page') {
            if (items.length === 0) return null;
            const start = pag.pageStart ?? 1;
            const cur = cursor ? Number(cursor) : start;
            return String(cur + 1);
        }
        if (pag.kind === 'offset') {
            if (items.length < pag.limit) return null;
            const off = cursor ? Number(cursor) : 0;
            return String(off + pag.limit);
        }
        return null;
    }

    // -----------------------------------------------------------------
    // Auth
    // -----------------------------------------------------------------

    private authHeaders(): Record<string, string> {
        const h: Record<string, string> = {accept: '*/*'};
        const mode = this.cfg.authMode || 'none';
        const cred = this.cfg.credential || '';
        if (mode === 'bearer' && cred) h['Authorization'] = `Bearer ${cred}`;
        else if (mode === 'apiKey' && cred) {
            const headerName = this.cfg.apiKeyHeader || 'X-Api-Key';
            h[headerName] = cred;
        } else if (mode === 'basic' && cred) {
            // `cred` is `'user:pass'` colon form per spec.
            const b64 = Buffer.from(cred, 'utf8').toString('base64');
            h['Authorization'] = `Basic ${b64}`;
        }
        return h;
    }

    // -----------------------------------------------------------------
    // Body parsing
    // -----------------------------------------------------------------

    private parseBody(body: string, contentType: string): WarehouseProductRow[] {
        const trimmed = body.trim();
        if (!trimmed) return [];

        // CSV / TSV
        if (contentType.includes('text/csv') || contentType.includes('text/tab-separated-values')) {
            return this.parseDelimited(trimmed, contentType.includes('tab') ? '\t' : ',');
        }
        // NDJSON
        if (contentType.includes('ndjson') || contentType.includes('jsonl')) {
            return trimmed.split(/\r?\n/).filter(Boolean).map(line => {
                try { return this.mapRow(JSON.parse(line)); } catch { return null; }
            }).filter((r): r is WarehouseProductRow => r !== null);
        }

        // Text fallback — sniff first non-whitespace char.
        const first = trimmed[0];
        if (first === '[' || first === '{' || contentType.includes('json')) {
            const parsed = JSON.parse(trimmed);
            const arr = this.extractArray(parsed);
            return arr.map(o => this.mapRow(o)).filter(r => r !== null) as WarehouseProductRow[];
        }
        // Last resort: treat as CSV with auto delimiter (comma vs tab in line 1).
        const firstLine = trimmed.split(/\r?\n/, 1)[0] || '';
        const tabs = (firstLine.match(/\t/g) || []).length;
        const commas = (firstLine.match(/,/g) || []).length;
        return this.parseDelimited(trimmed, tabs > commas ? '\t' : ',');
    }

    private extractArray(parsed: any): any[] {
        if (Array.isArray(parsed)) return parsed;
        if (this.cfg.itemsPath) {
            const at = getByPath(parsed, this.cfg.itemsPath);
            if (Array.isArray(at)) return at;
            return [];
        }
        // Auto-detect the longest array property.
        if (parsed && typeof parsed === 'object') {
            let best: any[] = [];
            for (const k of Object.keys(parsed)) {
                const v = parsed[k];
                if (Array.isArray(v) && v.length > best.length) best = v;
            }
            return best;
        }
        return [];
    }

    private parseDelimited(body: string, delim: string): WarehouseProductRow[] {
        const lines = body.split(/\r?\n/).filter(l => l.length > 0);
        if (lines.length < 2) return [];
        const header = parseCsvLine(lines[0], delim);
        const out: WarehouseProductRow[] = [];
        for (let i = 1; i < lines.length; i++) {
            const cells = parseCsvLine(lines[i], delim);
            if (cells.length === 0) continue;
            const obj: Record<string, string> = {};
            for (let c = 0; c < header.length; c++) obj[header[c]] = cells[c] ?? '';
            const row = this.mapRow(obj);
            if (row) out.push(row);
        }
        return out;
    }

    private mapRow(raw: any): WarehouseProductRow | null {
        if (!raw || typeof raw !== 'object') return null;
        const fm = this.cfg.fieldMap || {};
        const pick = (key: keyof WarehouseProductRow): unknown => {
            const path = fm[key];
            if (!path) return undefined;
            return getByPath(raw, path);
        };
        const externalId = String(pick('externalId') ?? '').trim();
        const title = String(pick('title') ?? '').trim();
        const currency = String(pick('currency') ?? '').trim();
        const priceRaw = pick('priceCents');
        const stockRaw = pick('stock');
        // Coerce numbers — CSV gives strings.
        const priceCents = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw);
        const stock = typeof stockRaw === 'number' ? stockRaw : Number(stockRaw);
        // We deliberately allow the row through even with missing fields —
        // InventoryService validates and dead-letters bad rows. The adapter
        // is a transport, not a validator. But: if `externalId` is empty
        // the upsert will reject; we still emit the row so the orchestrator
        // can record the failure.
        const updatedAt = String(pick('updatedAt') ?? new Date().toISOString());
        const sku = pick('sku');
        const description = pick('description');
        const images = pick('images');
        const attributes = pick('attributes');
        return {
            externalId,
            title,
            currency,
            priceCents: Number.isFinite(priceCents) ? priceCents : 0,
            stock: Number.isFinite(stock) ? stock : 0,
            updatedAt,
            ...(typeof sku === 'string' && sku ? {sku} : {}),
            ...(typeof description === 'string' ? {description} : {}),
            ...(Array.isArray(images) ? {images: images.map(String)} : (typeof images === 'string' && images ? {images: images.split('|').map(s => s.trim()).filter(Boolean)} : {})),
            ...(attributes && typeof attributes === 'object' ? {attributes: attributes as Record<string, unknown>} : {}),
        };
    }
}

/** Tiny dot-path resolver. Supports `'a.b.c'`. No bracket / wildcard. */
export function getByPath(obj: unknown, path: string): unknown {
    if (!path) return obj;
    const segs = path.split('.');
    let cur: any = obj;
    for (const s of segs) {
        if (cur == null) return undefined;
        cur = cur[s];
    }
    return cur;
}

/** Minimal RFC 4180-ish CSV line parser. Handles `"…"` quoting + `""` escapes. */
function parseCsvLine(line: string, delim: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') { cur += '"'; i++; }
                else inQuotes = false;
            } else {
                cur += ch;
            }
        } else {
            if (ch === '"') inQuotes = true;
            else if (ch === delim) { out.push(cur); cur = ''; }
            else cur += ch;
        }
    }
    out.push(cur);
    return out;
}

export const __test__ = {DEFAULT_PAGE_LIMIT, parseCsvLine};
