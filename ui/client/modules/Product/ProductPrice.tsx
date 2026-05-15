/**
 * Storefront price renderer (W8g — multi-currency-and-tax).
 *
 * Single price-rendering primitive shared by every Product-module variant
 * (card / featured / comparison / grid …). Resolves the visitor's display
 * currency from the locale + the `display_currency` cookie, picks the
 * native price from the product's `prices` map when one exists, and falls
 * back to the base-currency amount with a `≈` "converted" hint otherwise.
 *
 * FX *conversion* of the fallback amount is a service-side concern
 * (`EcbFxService`); when no native price exists we show the base amount
 * verbatim with the `≈` marker so the visitor knows checkout will be in
 * the operator's transaction currency. Wiring the live converted figure
 * through SSR `pageProps` is the page-renderer's job — this component
 * degrades gracefully until then.
 */
import React from 'react';
import {useDisplayCurrency} from '@client/components/CurrencySwitcher';
import {formatDisplayMoney} from '@client/lib/checkout/api';
import {pickPrice, resolveDisplayCurrency} from '@utils/displayCurrency';
import type {SupportedCurrency} from '@interfaces/IPricing';

export interface ProductPriceProps {
    /** Multi-currency map, minor units keyed by ISO-4217. */
    prices?: Record<string, number>;
    /** Legacy single-currency amount (minor units). */
    price?: number;
    /** Legacy single-currency code. */
    currency?: string;
    /** FX-fallback pivot. Defaults to `currency`. */
    baseCurrency?: string;
    /** Active storefront locale — drives the default display currency. */
    locale?: string;
    /** Operator's site-default display currency. */
    siteDefaultCurrency?: SupportedCurrency;
    /** testid for the rendered `<span>`. */
    testId?: string;
    className?: string;
}

export const ProductPrice: React.FC<ProductPriceProps> = ({
    prices,
    price,
    currency,
    baseCurrency,
    locale,
    siteDefaultCurrency,
    testId,
    className,
}) => {
    // Cookie / client-preference override; SSR-safe default chosen from
    // locale + site default so the first paint isn't always EUR.
    const localeDefault = resolveDisplayCurrency({
        siteDefault: siteDefaultCurrency,
        locale,
        baseCurrency: baseCurrency ?? currency,
    });
    const {currency: displayCurrency} = useDisplayCurrency(localeDefault);

    const picked = pickPrice(prices, displayCurrency, {
        baseCurrency: baseCurrency ?? currency,
        legacyPrice: typeof price === 'number' ? price : null,
        legacyCurrency: currency ?? null,
    });

    if (!picked) return null;

    return (
        <span
            className={className}
            data-testid={testId}
            data-display-currency={displayCurrency}
            data-price-native={picked.native ? 'true' : 'false'}
            title={picked.native
                ? undefined
                : `Approximate — published in ${picked.currency}; checkout is in the store's transaction currency.`}
        >
            {formatDisplayMoney(picked.amount, picked.currency, {approx: !picked.native})}
        </span>
    );
};

export default ProductPrice;
