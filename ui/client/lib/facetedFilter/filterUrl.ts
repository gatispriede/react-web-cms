/**
 * Faceted-filter URL <-> state codec.
 *
 * URL-state scheme (shareable, back-button safe, stable canonical form):
 *   - multi-select  → `key=v1,v2,v3`   (comma-joined, values sorted)
 *   - single-select → `key=value`
 *   - boolean       → `key=1`          (omitted entirely when false)
 *   - range         → `key=min-max`    (open ends allowed: `-25000`, `2000-`)
 *
 * Canonicalisation: facet keys are emitted in `facets[].order` then key
 * order; multi-select values are sorted alphabetically. The same filter
 * state therefore always produces the same query string — good for cache
 * keys + SEO canonical URLs.
 */
import type {FacetRange, FilterState, IFacetConfig} from './types';

type Query = Record<string, string | string[] | undefined>;

function firstString(v: string | string[] | undefined): string {
    if (Array.isArray(v)) return v[0] ?? '';
    return v ?? '';
}

function parseRange(raw: string): FacetRange | undefined {
    if (!raw.includes('-') && raw !== '') {
        // single bare number → treat as min only
        const n = Number(raw);
        return Number.isFinite(n) ? {min: n} : undefined;
    }
    const dash = raw.indexOf('-');
    if (dash < 0) return undefined;
    const minRaw = raw.slice(0, dash).trim();
    const maxRaw = raw.slice(dash + 1).trim();
    const out: FacetRange = {};
    if (minRaw !== '') {
        const n = Number(minRaw);
        if (Number.isFinite(n)) out.min = n;
    }
    if (maxRaw !== '') {
        const n = Number(maxRaw);
        if (Number.isFinite(n)) out.max = n;
    }
    return out.min === undefined && out.max === undefined ? undefined : out;
}

function serializeRange(r: FacetRange): string | undefined {
    const min = typeof r.min === 'number' ? String(r.min) : '';
    const max = typeof r.max === 'number' ? String(r.max) : '';
    if (min === '' && max === '') return undefined;
    return `${min}-${max}`;
}

/** Parse a Next.js `router.query` (or any flat query map) into FilterState. */
export function parseFilterUrl(query: Query, facets: IFacetConfig[]): FilterState {
    const state: FilterState = {};
    for (const facet of facets) {
        const raw = firstString(query[facet.key]).trim();
        if (raw === '') continue;
        switch (facet.kind) {
            case 'multi-select': {
                const values = raw.split(',').map(s => s.trim()).filter(Boolean);
                if (values.length > 0) state[facet.key] = [...new Set(values)].sort();
                break;
            }
            case 'single-select':
                state[facet.key] = raw;
                break;
            case 'boolean':
                if (raw === '1' || raw === 'true') state[facet.key] = true;
                break;
            case 'range': {
                const r = parseRange(raw);
                if (r) state[facet.key] = r;
                break;
            }
        }
    }
    return state;
}

/** Serialise FilterState into a flat, canonical query map (sorted, deduped). */
export function serializeFilterUrl(state: FilterState, facets: IFacetConfig[]): Record<string, string> {
    const out: Record<string, string> = {};
    // Iterate facets in declared `order` so the emitted query is stable.
    const ordered = [...facets].sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
    for (const facet of ordered) {
        const value = state[facet.key];
        if (value === undefined) continue;
        switch (facet.kind) {
            case 'multi-select': {
                if (Array.isArray(value) && value.length > 0) {
                    out[facet.key] = [...new Set(value)].sort().join(',');
                }
                break;
            }
            case 'single-select':
                if (typeof value === 'string' && value !== '') out[facet.key] = value;
                break;
            case 'boolean':
                if (value === true) out[facet.key] = '1';
                break;
            case 'range': {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    const s = serializeRange(value as FacetRange);
                    if (s) out[facet.key] = s;
                }
                break;
            }
        }
    }
    return out;
}

/** Canonical `?a=b&c=d` string (leading `?`, or '' when empty). */
export function toCanonicalQueryString(state: FilterState, facets: IFacetConfig[]): string {
    const map = serializeFilterUrl(state, facets);
    const parts = Object.entries(map).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** Round-trip a canonical query string back into FilterState. */
export function fromCanonicalQueryString(qs: string, facets: IFacetConfig[]): FilterState {
    const trimmed = qs.startsWith('?') ? qs.slice(1) : qs;
    const query: Query = {};
    if (trimmed !== '') {
        for (const pair of trimmed.split('&')) {
            const eq = pair.indexOf('=');
            if (eq < 0) continue;
            const k = decodeURIComponent(pair.slice(0, eq));
            const v = decodeURIComponent(pair.slice(eq + 1));
            query[k] = v;
        }
    }
    return parseFilterUrl(query, facets);
}

/** True when no facet constrains the result set. */
export function isEmptyFilterState(state: FilterState): boolean {
    return Object.keys(serializeFilterUrlKeys(state)).length === 0;
}

function serializeFilterUrlKeys(state: FilterState): Record<string, true> {
    const out: Record<string, true> = {};
    for (const [k, v] of Object.entries(state)) {
        if (v === undefined) continue;
        if (Array.isArray(v)) {
            if (v.length > 0) out[k] = true;
        } else if (typeof v === 'object') {
            const r = v as FacetRange;
            if (r.min !== undefined || r.max !== undefined) out[k] = true;
        } else if (typeof v === 'string') {
            if (v !== '') out[k] = true;
        } else if (v === true) {
            out[k] = true;
        }
    }
    return out;
}
