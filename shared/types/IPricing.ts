/**
 * Pricing / VAT / FX domain types — see docs/roadmap/storefront/multi-currency-and-tax.md.
 *
 * `MoneyAmount` is the wire shape for any currency-aware price (minor units,
 * matching how Stripe quotes amounts). `IProduct.prices` is a sparse record
 * keyed by ISO-4217 currency — operators publish a native price per market
 * they care about, and the FX layer fills in the rest at display time.
 */

/**
 * Supported display + transaction currencies. The list is deliberately small
 * and Europe-centric (the operator's primary market) plus the major reserves
 * to keep customers from bouncing off "no GBP / USD" on cross-border carts.
 * Add to this list rather than free-text; downstream `<Select>` components
 * read the registry so adding a currency is a single-line change.
 */
export const SUPPORTED_CURRENCIES = [
    'EUR',
    'USD',
    'GBP',
    'SEK',
    'NOK',
    'DKK',
    'PLN',
    'CHF',
    'CAD',
    'AUD',
] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

export interface MoneyAmount {
    /** Minor units (cents). */
    amount: number;
    currency: string;
}

/**
 * VAT regime resolved at quote / checkout time.
 *
 * Regimes (encoded mechanically by `VatRegimeService`):
 *   - `b2c-eu` — buyer in seller's EU country → seller's domestic VAT.
 *   - `b2c-eu-cross` — EU buyer in *different* EU country → still seller's
 *     domestic VAT (post-OSS) for digital + low-value goods; for B2C
 *     above-distance-sale thresholds the seller should be OSS-registered
 *     anyway, so v1 treats every B2C-EU sale as seller-domestic-rate.
 *   - `b2b-eu-reverse-charge` — verified intra-EU B2B → 0% VAT; buyer
 *     self-accounts. Requires a VIES-verified VAT number.
 *   - `b2c-non-eu` — non-EU buyer → 0% (export); seller may need to
 *     declare separately, out of scope here.
 *   - `b2b-non-eu` — non-EU business → 0% (export).
 */
export type VatRegimeKind =
    | 'b2c-eu'
    | 'b2c-eu-cross'
    | 'b2b-eu-reverse-charge'
    | 'b2c-non-eu'
    | 'b2b-non-eu';

export interface VatRegime {
    kind: VatRegimeKind;
    /** Decimal rate, e.g. 0.21 for 21 %. Zero for reverse-charge / export. */
    vatRate: number;
    /** Buyer country code we resolved against (uppercase ISO-3166 alpha-2). */
    buyerCountry: string;
    /** Seller country code (operator's tax-residence country). */
    sellerCountry: string;
    /** When kind === 'b2b-eu-reverse-charge': the VAT number that unlocked it. */
    vatNumber?: string;
    /** When kind === 'b2b-eu-reverse-charge': did VIES confirm or did we fall back to format-only? */
    viesVerified?: boolean;
    /** Human-readable note for invoices ("Reverse charge B2B …"). */
    note?: string;
}

export interface VatLine {
    /** Stable line id, echoed from the caller (often product id). */
    id: string;
    /** Net amount (excluding VAT) in minor units. */
    net: number;
    /** Tax amount in minor units. */
    tax: number;
    /** Gross = net + tax. */
    gross: number;
    /** Effective rate applied. */
    rate: number;
}

export interface VatBreakdown {
    regime: VatRegime;
    lines: VatLine[];
    totals: {
        net: number;
        tax: number;
        gross: number;
    };
    currency: string;
    /** Provider that produced this — internal regime or Stripe Tax. */
    provider: 'internal' | 'stripe-tax';
}

export interface FxRateSnapshot {
    /** ISO date (YYYY-MM-DD) of the rates as published by ECB. */
    date: string;
    /** Always 'EUR' for ECB. */
    base: string;
    /** Rates of `base → currency`. base→base is implicitly 1. */
    rates: Record<string, number>;
    /** When we fetched it (may lag publish date). */
    fetchedAt: string;
    source: 'ecb' | 'manual' | 'fallback';
}

export interface ViesValidationResult {
    /** True when format and (where checked) VIES service agree. */
    valid: boolean;
    /** True when the VIES SOAP service confirmed; false on fallback. */
    viesVerified: boolean;
    countryCode: string;
    vatNumber: string;
    /** Company name returned by VIES, if any. */
    name?: string;
    /** Company address returned by VIES, if any. */
    address?: string;
    /** Error code on failure ('FORMAT', 'INVALID', 'VIES_DOWN', etc). */
    error?: string;
    /** When the result was cached. */
    cachedAt?: string;
}

/** EU member state country codes (alpha-2, uppercase). */
export const EU_COUNTRY_CODES = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
] as const;

export type EuCountryCode = typeof EU_COUNTRY_CODES[number];

/**
 * Standard VAT rates per EU member state (decimal). Static table — operator
 * can override per-country from the admin pane (writes go to `SiteConfig`).
 *
 * Source: European Commission "VAT rates applied in the Member States of the
 * European Union" — re-check yearly (rates change rarely; LV stayed at 21 %
 * since 2011, DE blip to 16 % during covid is the most recent material change).
 */
export const EU_STANDARD_VAT_RATES: Record<EuCountryCode, number> = {
    AT: 0.20, BE: 0.21, BG: 0.20, HR: 0.25, CY: 0.19, CZ: 0.21, DK: 0.25,
    EE: 0.22, FI: 0.255, FR: 0.20, DE: 0.19, GR: 0.24, HU: 0.27, IE: 0.23,
    IT: 0.22, LV: 0.21, LT: 0.21, LU: 0.17, MT: 0.18, NL: 0.21, PL: 0.23,
    PT: 0.23, RO: 0.19, SK: 0.23, SI: 0.22, ES: 0.21, SE: 0.25,
};
