/**
 * Flat-rate per-country tax stub. Real implementations would defer to a
 * tax service (Avalara, TaxJar, etc.); for v1 a small lookup table is
 * enough — the rate is applied to the subtotal after shipping.
 */

export const TAX_RATES: Record<string, number> = {
    US: 0,
    LV: 0.21,
    DE: 0.19,
};

export const DEFAULT_TAX_RATE = 0;

export function taxRateFor(country: string | undefined | null): number {
    if (!country) return DEFAULT_TAX_RATE;
    const key = country.trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(TAX_RATES, key) ? TAX_RATES[key] : DEFAULT_TAX_RATE;
}

/** Round to integer minor units. */
export function roundMinor(n: number): number {
    return Math.round(n);
}
