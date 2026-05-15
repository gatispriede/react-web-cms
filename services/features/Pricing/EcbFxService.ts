/**
 * ECB daily-rates FX service (W8g).
 *
 * Source: https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml.
 *   - Published once per business day around 14:30 UTC, base = EUR.
 *   - Free + authoritative for EU operators.
 *
 * Strategy:
 *   - Lazy fetch on stale cache (TTL 24h). No standalone cron — every
 *     callsite that needs a rate calls `getSnapshot()`, and the first call
 *     after a stale window triggers a single refresh. Concurrent callers
 *     dedupe on the in-flight promise.
 *   - On fetch failure, the stale snapshot (or hardcoded fallback) is
 *     returned. We never block checkout on ECB being slow.
 *   - Test / build mode: env `PRICING_DISABLE_FX_FETCH=1` short-circuits to
 *     the hardcoded fallback (used by `npm run lint` / `npm run build`).
 *
 * Conversion convention: ECB publishes `EUR → X`. To convert any pair we
 * pivot through EUR (`from→EUR→to`).
 */
import {log} from '@services/infra/logger';
import type {FxRateSnapshot} from '@interfaces/IPricing';

/**
 * Hardcoded fallback used when ECB is unreachable AND no cache exists yet.
 * Static-ish 2026-vintage rates; the order of magnitude is what matters
 * (we never let a "convert" return zero or NaN at display time). Operators
 * can override via the admin pane.
 */
const FALLBACK_RATES: Record<string, number> = {
    USD: 1.08,
    GBP: 0.85,
    SEK: 11.30,
    NOK: 11.50,
    DKK: 7.46,
    PLN: 4.30,
    CHF: 0.95,
    CAD: 1.47,
    AUD: 1.64,
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface EcbFxOptions {
    /** Override the ECB url (tests). */
    url?: string;
    /** Override the cache TTL in ms. Default 24h. */
    ttlMs?: number;
    /** Inject a fetch impl for tests. */
    fetchImpl?: typeof fetch;
}

export class EcbFxService {
    private snapshot: FxRateSnapshot | null = null;
    private inflight: Promise<FxRateSnapshot> | null = null;
    private readonly url: string;
    private readonly ttlMs: number;
    private readonly fetchImpl: typeof fetch;
    private manualOverrides: Record<string, number> = {};

    constructor(opts: EcbFxOptions = {}) {
        this.url = opts.url ?? 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
        this.ttlMs = opts.ttlMs ?? ONE_DAY_MS;
        // `fetch` is global in Node 18+; bind so the spec-mandated `this`
        // binding doesn't trip on the global. Tests can inject a stub.
        this.fetchImpl = opts.fetchImpl ?? ((globalThis as { fetch?: typeof fetch }).fetch as typeof fetch);
    }

    /** Operator-set manual override for a currency. Merged into rates on read. */
    setManualRate(currency: string, rate: number): void {
        if (!currency || !Number.isFinite(rate) || rate <= 0) return;
        this.manualOverrides[currency.toUpperCase()] = rate;
        if (this.snapshot) {
            this.snapshot = {
                ...this.snapshot,
                rates: {...this.snapshot.rates, [currency.toUpperCase()]: rate},
                source: 'manual',
            };
        }
    }

    private isStale(): boolean {
        if (!this.snapshot) return true;
        const fetchedAt = Date.parse(this.snapshot.fetchedAt);
        if (!Number.isFinite(fetchedAt)) return true;
        return Date.now() - fetchedAt > this.ttlMs;
    }

    private fallbackSnapshot(): FxRateSnapshot {
        return {
            date: new Date().toISOString().slice(0, 10),
            base: 'EUR',
            rates: {...FALLBACK_RATES, ...this.manualOverrides},
            fetchedAt: new Date().toISOString(),
            source: 'fallback',
        };
    }

    /** Returns the current snapshot — refreshing lazily if stale. */
    async getSnapshot(): Promise<FxRateSnapshot> {
        if (process.env.PRICING_DISABLE_FX_FETCH === '1') {
            this.snapshot ??= this.fallbackSnapshot();
            return this.snapshot;
        }
        if (!this.isStale() && this.snapshot) return this.snapshot;
        if (this.inflight) return this.inflight;
        this.inflight = this.refresh()
            .catch(err => {
                log.error({scope: 'pricing.fx.refresh', err}, 'ECB FX refresh failed; using cache/fallback');
                return this.snapshot ?? this.fallbackSnapshot();
            })
            .finally(() => { this.inflight = null; });
        return this.inflight;
    }

    /** Force a refresh. Returns the new snapshot or throws on hard failure. */
    async refresh(): Promise<FxRateSnapshot> {
        if (!this.fetchImpl) throw new Error('fetch unavailable');
        const res = await this.fetchImpl(this.url, {
            headers: {Accept: 'application/xml, text/xml'},
        });
        if (!res.ok) throw new Error(`ECB fetch ${res.status}`);
        const xml = await res.text();
        const rates = parseEcbXml(xml);
        const date = (/time="(\d{4}-\d{2}-\d{2})"/.exec(xml)?.[1]) ?? new Date().toISOString().slice(0, 10);
        const next: FxRateSnapshot = {
            date,
            base: 'EUR',
            rates: {...rates, ...this.manualOverrides},
            fetchedAt: new Date().toISOString(),
            source: 'ecb',
        };
        this.snapshot = next;
        return next;
    }

    /**
     * Convert minor units from `from` → `to` using the latest snapshot.
     * `from === to` short-circuits (no FX). Unknown currencies fall back
     * to identity (returns same amount + logs once).
     */
    async convert(amount: number, from: string, to: string): Promise<number> {
        const f = (from || '').toUpperCase();
        const t = (to || '').toUpperCase();
        if (!f || !t || f === t) return amount;
        const snap = await this.getSnapshot();
        const ratesWithBase: Record<string, number> = {...snap.rates, [snap.base]: 1};
        const fromRate = ratesWithBase[f];
        const toRate = ratesWithBase[t];
        if (!fromRate || !toRate) {
            log.warn({scope: 'pricing.fx.convert', from: f, to: t}, 'unknown currency in conversion');
            return amount;
        }
        return Math.round((amount / fromRate) * toRate);
    }

    /** Direct rate `from → to`. Returns 1 on identity / unknown. */
    async getRate(from: string, to: string): Promise<number> {
        const f = (from || '').toUpperCase();
        const t = (to || '').toUpperCase();
        if (!f || !t || f === t) return 1;
        const snap = await this.getSnapshot();
        const ratesWithBase: Record<string, number> = {...snap.rates, [snap.base]: 1};
        const fromRate = ratesWithBase[f];
        const toRate = ratesWithBase[t];
        if (!fromRate || !toRate) return 1;
        return toRate / fromRate;
    }
}

/**
 * Naive ECB XML parser. The document is tiny (~3 KB, one `<Cube>` per
 * currency) so we avoid pulling a SAX parser. Format:
 *
 *   <Cube currency="USD" rate="1.0832"/>
 *   <Cube currency="GBP" rate="0.8567"/>
 *
 * We extract every `<Cube currency="X" rate="Y"/>` and ignore the wrapping
 * `<Cube time=…>` element.
 */
export function parseEcbXml(xml: string): Record<string, number> {
    const out: Record<string, number> = {};
    const re = /<Cube\s+currency="([A-Z]{3})"\s+rate="([\d.]+)"\s*\/>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
        const code = m[1];
        const rate = parseFloat(m[2]);
        if (Number.isFinite(rate) && rate > 0) out[code] = rate;
    }
    return out;
}

let cached: EcbFxService | null = null;
export function getEcbFxService(): EcbFxService {
    if (!cached) cached = new EcbFxService();
    return cached;
}

/** Test helper — reset the singleton between tests. */
export function _resetEcbFxForTests(): void { cached = null; }
