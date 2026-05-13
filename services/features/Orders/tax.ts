/**
 * Per-country VAT rate lookup. Originally a hand-maintained 3-row stub;
 * since W8g (Pricing) it delegates to the full EU regime resolver +
 * static rate table, so the order-side rate is consistent with the
 * checkout regime resolver and the invoice line. The legacy
 * `TAX_RATES` + `DEFAULT_TAX_RATE` exports are kept as aliases for any
 * caller that imports them directly.
 *
 * For the regime-aware path (reverse-charge / export / cross-EU), call
 * `VatRegimeService.resolve(...)` directly — `taxRateFor` collapses to
 * the seller-domestic rate when given a single country code, which is
 * what `OrderService.recalc` historically asked for.
 */
import {EU_STANDARD_VAT_RATES, type EuCountryCode, EU_COUNTRY_CODES} from '@interfaces/IPricing';

export const DEFAULT_TAX_RATE = 0;

export const TAX_RATES: Record<string, number> = {
    ...EU_STANDARD_VAT_RATES,
    US: 0,
};

export function taxRateFor(country: string | undefined | null): number {
    if (!country) return DEFAULT_TAX_RATE;
    const key = country.trim().toUpperCase();
    if ((EU_COUNTRY_CODES as readonly string[]).includes(key)) {
        return EU_STANDARD_VAT_RATES[key as EuCountryCode];
    }
    if (Object.prototype.hasOwnProperty.call(TAX_RATES, key)) return TAX_RATES[key];
    return DEFAULT_TAX_RATE;
}

/** Round to integer minor units. */
export function roundMinor(n: number): number {
    return Math.round(n);
}
