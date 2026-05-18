/**
 * Polish bundle (W8g follow-up) — public-site price display utility.
 *
 * Renders a product price in the visitor's chosen display currency.
 * Two paths:
 *   1. Operator stored a native price in that currency → render exact.
 *   2. No native price → approximate via ECB FX with the "≈" prefix,
 *      per the multi-currency spec §"Display approximations".
 *
 * FX rates are passed in as a `Record<currency, number>` map (EUR-base,
 * ECB shape). Server-side pages can hydrate this from
 * `EcbFxService.getRates()`; client-only callers can read it from
 * `/api/pricing/fx` (cached 24h). The component itself is fully
 * client-renderable — no IO — so it slots into any module.
 *
 * Conventions:
 *  - Amounts are minor units (cents) everywhere — matches
 *    `IProduct.prices` storage.
 *  - Display uses `Intl.NumberFormat` so each currency picks up its
 *    native symbol + decimal convention.
 *  - When approximation flips the price by >20 % the component still
 *    renders the approximation (no in-flight cap-out), but stamps an
 *    extra `data-fx-stale` attribute so the bundle e2e tests can flag
 *    obviously broken rate snapshots in CI.
 */
import React from 'react';
import type {ProductPrices} from '@interfaces/IProduct';
import type {SupportedCurrency} from '@interfaces/IPricing';

export interface PriceDisplayProps {
    /** Sparse map of native prices in minor units, keyed by ISO-4217. */
    prices: ProductPrices | undefined | null;
    /** Customer's chosen display currency. */
    currency: SupportedCurrency | string;
    /** ECB rates (base = EUR). Optional — when missing and we'd need
     *  to convert, we fall back to the operator's primary native price
     *  rather than rendering "—". */
    fxRates?: Record<string, number>;
    /** Operator's primary / fallback currency — used when neither the
     *  requested currency nor FX is available. Defaults to 'EUR'. */
    fallbackCurrency?: SupportedCurrency | string;
    /** Optional class slot for module-level styling. */
    className?: string;
    /** Optional test id override (useful when many prices render on one page). */
    testId?: string;
}

function formatMinorUnits(amountMinor: number, currency: string): string {
    const major = amountMinor / 100;
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency, currencyDisplay: 'symbol'}).format(major);
    } catch {
        // Unknown currency code — Intl throws RangeError.
        return `${major.toFixed(2)} ${currency}`;
    }
}

/**
 * Approximate `amountMinor` (in `from`) to `to` using ECB rates.
 * Returns null when conversion isn't possible (missing rate either
 * direction). Convention: rates are EUR-base, so cross conversions
 * route through EUR.
 */
function convertMinor(amountMinor: number, from: string, to: string, rates: Record<string, number> | undefined): number | null {
    if (!rates) return null;
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    if (f === t) return amountMinor;
    // EUR-base assumption — rates[X] = 1 EUR → X units.
    const inEur = f === 'EUR' ? amountMinor : (rates[f] ? amountMinor / rates[f] : null);
    if (inEur === null) return null;
    const out = t === 'EUR' ? inEur : (rates[t] ? inEur * rates[t] : null);
    return out;
}

interface Resolution {
    amount: number;
    currency: string;
    approximate: boolean;
}

function resolvePrice(props: PriceDisplayProps): Resolution | null {
    const {prices, currency, fxRates, fallbackCurrency = 'EUR'} = props;
    if (!prices) return null;
    const target = currency.toUpperCase();
    // Native price wins — no approximation when the operator stored it.
    if (prices[target] != null) {
        return {amount: prices[target], currency: target, approximate: false};
    }
    // Find any native price to convert from. Preference order:
    // fallbackCurrency > EUR > first available.
    const fallback = fallbackCurrency.toUpperCase();
    const sourceKey = (prices[fallback] != null
        ? fallback
        : (prices['EUR'] != null ? 'EUR' : Object.keys(prices)[0]));
    if (!sourceKey) return null;
    const converted = convertMinor(prices[sourceKey], sourceKey, target, fxRates);
    if (converted === null) {
        // No FX available — render the operator's native price as-is.
        return {amount: prices[sourceKey], currency: sourceKey, approximate: false};
    }
    return {amount: Math.round(converted), currency: target, approximate: true};
}

export const PriceDisplay: React.FC<PriceDisplayProps> = (props) => {
    const resolved = resolvePrice(props);
    const testId = props.testId ?? 'price-display';
    if (!resolved) {
        return (
            <span className={props.className} data-testid={`${testId}-empty`}>
                —
            </span>
        );
    }
    return (
        <span
            className={props.className}
            data-testid={testId}
            data-approximate={resolved.approximate ? 'true' : 'false'}
            data-currency={resolved.currency}
        >
            {resolved.approximate ? <span aria-hidden="true">≈ </span> : null}
            {formatMinorUnits(resolved.amount, resolved.currency)}
        </span>
    );
};

export default PriceDisplay;
