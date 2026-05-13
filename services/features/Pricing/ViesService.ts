/**
 * VIES B2B VAT-ID validator (W8g).
 *
 * Wraps the EU SOAP endpoint:
 *   https://ec.europa.eu/taxation_customs/vies/services/checkVatService
 *
 * Behavioural contract:
 *   - Two-stage validation: cheap format check first; SOAP call only on
 *     format pass.
 *   - 24h in-memory cache on `valid + viesVerified` results, 1h on
 *     `valid=false` (so a typo doesn't get re-checked every keystroke).
 *   - Service down (network error, 5xx, timeout 5 s) → fall back to
 *     "format valid, viesVerified=false". Never blocks checkout.
 *   - Env `PRICING_DISABLE_VIES_FETCH=1` short-circuits to format-only
 *     mode (used at lint/build time and offline tests).
 */
import {log} from '@services/infra/logger';
import type {ViesValidationResult} from '@interfaces/IPricing';
import {EU_COUNTRY_CODES} from '@interfaces/IPricing';

const SOAP_URL = 'https://ec.europa.eu/taxation_customs/vies/services/checkVatService';
const VALID_TTL_MS = 24 * 60 * 60 * 1000;
const INVALID_TTL_MS = 60 * 60 * 1000;
const SOAP_TIMEOUT_MS = 5000;

export interface ViesOptions {
    url?: string;
    fetchImpl?: typeof fetch;
    /** Override timeout in ms. */
    timeoutMs?: number;
}

interface CacheEntry {
    result: ViesValidationResult;
    expiresAt: number;
}

export class ViesService {
    private readonly url: string;
    private readonly fetchImpl: typeof fetch;
    private readonly timeoutMs: number;
    private cache = new Map<string, CacheEntry>();

    constructor(opts: ViesOptions = {}) {
        this.url = opts.url ?? SOAP_URL;
        this.fetchImpl = opts.fetchImpl ?? ((globalThis as { fetch?: typeof fetch }).fetch as typeof fetch);
        this.timeoutMs = opts.timeoutMs ?? SOAP_TIMEOUT_MS;
    }

    /**
     * Validates `vatId`. Accepts either:
     *   - `LV40003012345` (country prefix + number)
     *   - `40003012345` alone is rejected (no country)
     *
     * Returns synchronously from cache when available.
     */
    async validate(vatId: string): Promise<ViesValidationResult> {
        const norm = normalizeVatId(vatId);
        if (!norm.ok) {
            return {
                valid: false,
                viesVerified: false,
                countryCode: norm.countryCode || '',
                vatNumber: norm.vatNumber || '',
                error: norm.error,
            };
        }
        const key = `${norm.countryCode}:${norm.vatNumber}`;
        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > Date.now()) return cached.result;

        // Disabled-at-build-time path: format pass = "unverified valid".
        if (process.env.PRICING_DISABLE_VIES_FETCH === '1') {
            const res: ViesValidationResult = {
                valid: true,
                viesVerified: false,
                countryCode: norm.countryCode,
                vatNumber: norm.vatNumber,
                error: 'VIES_DISABLED',
                cachedAt: new Date().toISOString(),
            };
            this.cache.set(key, {result: res, expiresAt: Date.now() + INVALID_TTL_MS});
            return res;
        }

        try {
            const soap = buildSoapEnvelope(norm.countryCode, norm.vatNumber);
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
            const res = await this.fetchImpl(this.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': '',
                },
                body: soap,
                signal: ctrl.signal,
            }).finally(() => clearTimeout(t));
            if (!res.ok) throw new Error(`VIES HTTP ${res.status}`);
            const xml = await res.text();
            const parsed = parseSoapResponse(xml);
            const result: ViesValidationResult = {
                valid: parsed.valid,
                viesVerified: true,
                countryCode: norm.countryCode,
                vatNumber: norm.vatNumber,
                name: parsed.name,
                address: parsed.address,
                cachedAt: new Date().toISOString(),
            };
            this.cache.set(key, {
                result,
                expiresAt: Date.now() + (parsed.valid ? VALID_TTL_MS : INVALID_TTL_MS),
            });
            return result;
        } catch (err) {
            log.warn({scope: 'pricing.vies', err, vatId: key}, 'VIES lookup failed; falling back to format-only');
            const fallback: ViesValidationResult = {
                valid: true,
                viesVerified: false,
                countryCode: norm.countryCode,
                vatNumber: norm.vatNumber,
                error: 'VIES_DOWN',
                cachedAt: new Date().toISOString(),
            };
            // Short cache so a transient outage doesn't pin "unverified"
            // status for 24h; revisit on next attempt.
            this.cache.set(key, {result: fallback, expiresAt: Date.now() + INVALID_TTL_MS});
            return fallback;
        }
    }

    /** Test hook — wipe the cache. */
    _resetCache(): void { this.cache.clear(); }
}

interface NormalizedVatId {
    ok: boolean;
    countryCode: string;
    vatNumber: string;
    error?: string;
}

/**
 * Cheap format normalisation. Accepts whitespace + dashes + lowercase;
 * splits leading 2-letter country code from the rest. Country code must
 * be EU. Number must be 4–14 alphanumerics (covers e.g. NL with letter
 * suffixes + most member-state shapes).
 */
export function normalizeVatId(raw: string | undefined | null): NormalizedVatId {
    if (!raw) return {ok: false, countryCode: '', vatNumber: '', error: 'FORMAT'};
    const cleaned = raw.toString().replace(/[\s-]/g, '').toUpperCase();
    if (cleaned.length < 6) return {ok: false, countryCode: '', vatNumber: '', error: 'FORMAT'};
    const cc = cleaned.slice(0, 2);
    const num = cleaned.slice(2);
    if (!(EU_COUNTRY_CODES as readonly string[]).includes(cc)) {
        return {ok: false, countryCode: cc, vatNumber: num, error: 'NON_EU_COUNTRY'};
    }
    if (!/^[0-9A-Z]{4,14}$/.test(num)) {
        return {ok: false, countryCode: cc, vatNumber: num, error: 'FORMAT'};
    }
    return {ok: true, countryCode: cc, vatNumber: num};
}

function buildSoapEnvelope(countryCode: string, vatNumber: string): string {
    // VIES checkVatService SOAP 1.1 envelope. Hand-crafted to avoid a SOAP
    // client dep — the request shape hasn't changed in over a decade.
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" ',
        'xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">',
        '<soapenv:Header/>',
        '<soapenv:Body>',
        '<urn:checkVat>',
        `<urn:countryCode>${countryCode}</urn:countryCode>`,
        `<urn:vatNumber>${vatNumber}</urn:vatNumber>`,
        '</urn:checkVat>',
        '</soapenv:Body>',
        '</soapenv:Envelope>',
    ].join('');
}

interface ParsedVies {
    valid: boolean;
    name?: string;
    address?: string;
}

export function parseSoapResponse(xml: string): ParsedVies {
    const valid = /<valid>\s*true\s*<\/valid>/i.test(xml);
    const nameMatch = /<name>([^<]*)<\/name>/i.exec(xml);
    const addrMatch = /<address>([^<]*)<\/address>/i.exec(xml);
    return {
        valid,
        name: nameMatch ? nameMatch[1].trim() : undefined,
        address: addrMatch ? addrMatch[1].trim() : undefined,
    };
}

let cached: ViesService | null = null;
export function getViesService(): ViesService {
    if (!cached) cached = new ViesService();
    return cached;
}
export function _resetViesForTests(): void { cached = null; }
