/**
 * ss.com cars normaliser — maps a raw ss.com ad object (whatever the
 * fetcher produced from RSS+HTML, or from a fixture) into the canonical
 * `WarehouseProductRow` shape consumed by `InventoryService`.
 *
 * Kept separate from `SsComCarsAdapter.ts` so the parser side stays
 * pure + unit-testable (no network, no DB). All fields are tolerant of
 * `undefined` / wrong-type input — the adapter is a transport, not a
 * validator. InventoryService dead-letters malformed rows downstream.
 *
 * VAT regime semantics — used cars in the EU run on two regimes:
 *   - `b2c-eu-margin` — VAT-margin scheme, VAT included, NOT reclaimable.
 *   - `b2c-eu`        — standard 21% VAT, reclaimable for businesses.
 * The `VatBadge` component on the storefront surfaces this verbatim so
 * the buyer sees the regime before clicking through.
 */
import type {WarehouseProductRow} from '@interfaces/IInventory';

/** Raw ss.com ad shape — produced by either the RSS/HTML fetcher or by
 *  reading the JSON fixture. All fields optional so the normaliser can
 *  gracefully degrade. */
export interface SsComRawAd {
    adId?: string;
    url?: string;
    title?: string;
    description?: string;
    priceEur?: number;
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    mileageKm?: number;
    fuel?: string;
    transmission?: string;
    body?: string;
    drive?: string;
    color?: string;
    region?: string;
    engineCc?: number;
    inspectionDate?: string;
    vatRegime?: string;
    countryOfOrigin?: string;
    dealType?: string;
    images?: string[];
    updatedAt?: string;
}

/** Recognised VAT regime tokens — anything else falls through to
 *  `'unknown'` for the operator review queue. Keep this list aligned
 *  with `ui/client/modules/Cars/VatBadge.tsx` rendering. */
export const VAT_REGIMES = ['b2c-eu', 'b2c-eu-margin', 'private-no-vat', 'unknown'] as const;
export type VatRegime = typeof VAT_REGIMES[number];

const KNOWN_FUEL = ['diesel', 'petrol', 'hybrid', 'phev', 'electric', 'lpg', 'cng'] as const;
const KNOWN_TRANSMISSION = ['manual', 'automatic', 'cvt', 'semi-auto'] as const;
const KNOWN_BODY = ['sedan', 'wagon', 'hatchback', 'coupe', 'suv', 'minivan', 'pickup', 'cabrio'] as const;
const KNOWN_DRIVE = ['fwd', 'rwd', 'awd', '4wd'] as const;

function pickEnum<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
    if (typeof value !== 'string') return undefined;
    const v = value.toLowerCase().trim();
    return (allowed as readonly string[]).includes(v) ? (v as T[number]) : undefined;
}

function normaliseVatRegime(value: unknown): VatRegime {
    if (typeof value !== 'string') return 'unknown';
    const v = value.toLowerCase().trim();
    if ((VAT_REGIMES as readonly string[]).includes(v)) return v as VatRegime;
    // Tolerate alternate spellings the fetcher might emit from raw copy.
    if (v.includes('margin')) return 'b2c-eu-margin';
    if (v.includes('private')) return 'private-no-vat';
    if (v.includes('21') || v === 'standard') return 'b2c-eu';
    return 'unknown';
}

function eurosToCents(priceEur: unknown): number {
    const n = typeof priceEur === 'number' ? priceEur : Number(priceEur);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
}

function titleOf(ad: SsComRawAd): string {
    const explicit = (ad.title ?? '').trim();
    if (explicit) return explicit;
    const parts = [ad.year, ad.make, ad.model, ad.trim].filter(Boolean).map(String);
    return parts.join(' ').trim() || `ss.com ad ${ad.adId ?? '?'}`;
}

/**
 * Wave 8b — PII keys we strip from any raw ss.com ad before its
 * attributes land in the storefront-visible Product. ss.com's
 * marketplace nature means most seller contact lives in the message
 * thread (not the listing body), but the RSS/HTML scrape can pick up
 * phone numbers or names from free-text fields if the seller embedded
 * them there. We belt-and-brace strip on the normaliser side so the
 * public listing page never serves them. Operator-controlled contact
 * form is the only exposed channel.
 */
const PII_KEYS_TO_STRIP = new Set<keyof SsComRawAd>([]);
const PII_PHONE_RE = /(?:\+?\d[\d\s\-()]{6,}\d)/g;
const PII_EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Strip phone/email tokens from a free-text string. */
export function redactPii(text: string): string {
    if (typeof text !== 'string' || text.length === 0) return text;
    return text
        .replace(PII_EMAIL_RE, '[contact via form]')
        .replace(PII_PHONE_RE, '[contact via form]');
}

/** Build the `attributes` map. Only string values per `IProduct.attributes`
 *  contract (Record<string, string>). Numbers / dates → string. */
function buildAttributes(ad: SsComRawAd): Record<string, string> {
    const out: Record<string, string> = {};
    const setIf = (k: string, v: unknown): void => {
        if (v === undefined || v === null) return;
        const s = String(v).trim();
        if (s) out[k] = s;
    };
    setIf('make', ad.make);
    setIf('model', ad.model);
    setIf('trim', ad.trim);
    setIf('year', ad.year);
    setIf('mileage_km', ad.mileageKm);
    const fuel = pickEnum(ad.fuel, KNOWN_FUEL);
    if (fuel) out.fuel = fuel;
    const transmission = pickEnum(ad.transmission, KNOWN_TRANSMISSION);
    if (transmission) out.transmission = transmission;
    const body = pickEnum(ad.body, KNOWN_BODY);
    if (body) out.body = body;
    const drive = pickEnum(ad.drive, KNOWN_DRIVE);
    if (drive) out.drive = drive;
    setIf('color', ad.color);
    setIf('region', ad.region);
    setIf('engine_cc', ad.engineCc);
    setIf('inspection_date', ad.inspectionDate);
    setIf('country_of_origin', ad.countryOfOrigin);
    setIf('deal_type', ad.dealType);
    setIf('ss_com_url', ad.url);
    out.vat_regime = normaliseVatRegime(ad.vatRegime);
    return out;
}

function buildCategories(ad: SsComRawAd): string[] {
    const cats = ['cars'];
    const body = pickEnum(ad.body, KNOWN_BODY);
    if (body) cats.push(body);
    return cats;
}

/**
 * Normalise one raw ss.com ad into the warehouse row.
 * Returns `null` when the ad has no usable `adId` — adId is the upsert
 * key (`externalId`) so a row without one is irrecoverable.
 */
export function normaliseAd(raw: SsComRawAd): WarehouseProductRow | null {
    const externalId = String(raw.adId ?? '').trim();
    if (!externalId) return null;
    const externalKey = `sscom:${externalId}`;
    // Wave 8b — redact phone/email tokens out of the description before
    // it goes anywhere downstream. Title is built from year/make/model
    // so it's PII-clean by construction; description is free-text from
    // the ad body and may contain seller contact info.
    const safeDescription = typeof raw.description === 'string'
        ? redactPii(raw.description)
        : '';
    const row: WarehouseProductRow = {
        externalId: externalKey,
        sku: externalKey,
        title: titleOf(raw),
        description: safeDescription,
        priceCents: eurosToCents(raw.priceEur),
        currency: 'EUR',
        stock: 1,
        updatedAt: raw.updatedAt && Date.parse(raw.updatedAt) > 0
            ? new Date(raw.updatedAt).toISOString()
            : new Date().toISOString(),
        images: Array.isArray(raw.images) ? raw.images.map(String).filter(Boolean) : [],
        attributes: buildAttributes(raw),
    };
    // Tuck categories into attributes for downstream consumption.
    // `WarehouseProductRow` doesn't carry `categories` directly — they
    // are derived server-side by `ProductService` (currently from the
    // attributes map). Adding here makes the intent obvious to operators
    // browsing the dead-letter queue.
    (row.attributes as Record<string, string>)._categoriesHint = buildCategories(raw).join(',');
    return row;
}

/** Bulk variant — fixtures hand us an array. */
export function normaliseAds(raws: SsComRawAd[]): WarehouseProductRow[] {
    return raws
        .map(normaliseAd)
        .filter((r): r is WarehouseProductRow => r !== null);
}

export const __test__ = {
    normaliseVatRegime,
    eurosToCents,
    titleOf,
    buildAttributes,
    buildCategories,
    redactPii,
    PII_KEYS_TO_STRIP,
};
