/**
 * Locale-driven display-currency resolution + multi-currency price pick
 * (W8g — multi-currency-and-tax).
 *
 * Shared between the storefront price-rendering path (`@utils/displayCurrency`
 * from `ui/client`) and any server-side renderer that needs the same answer.
 * Pure functions, no I/O — the actual FX conversion (when a product has no
 * native price in the display currency) is done by `EcbFxService` on the
 * service side; this module only decides *which* currency to show and picks
 * the native amount when one exists.
 *
 * Display-currency priority (per the spec §"Display-currency selection"):
 *   1. explicit cookie / customer override  (caller passes it in)
 *   2. authed customer `IUser.preferredCurrency`  (caller passes it in)
 *   3. site default                          (caller passes it in)
 *   4. locale → currency mapping             (this module)
 *   5. hard fallback to the product baseCurrency / 'EUR'
 *
 * The transaction currency is always the operator-set source currency — this
 * is display-time only. Never use the resolved display currency to charge.
 */
import {SUPPORTED_CURRENCIES, type SupportedCurrency} from '@interfaces/IPricing';

/**
 * Locale → display currency. Keyed by both the bare language subtag (`lv`,
 * `en`) and common region-qualified locales (`en-GB`, `en-US`). The spec's
 * worked examples: a visitor at `lv` sees EUR, at `en-GB` sees GBP.
 *
 * Region-qualified entries win over the bare-language fallback (see
 * `currencyForLocale` — it tries the full tag first, then the language).
 */
export const LOCALE_CURRENCY_MAP: Record<string, SupportedCurrency> = {
    // Eurozone / EUR-default markets
    lv: 'EUR', lt: 'EUR', et: 'EUR', ee: 'EUR', fi: 'EUR', de: 'EUR',
    fr: 'EUR', es: 'EUR', it: 'EUR', nl: 'EUR', pt: 'EUR', ie: 'EUR',
    'en-IE': 'EUR', 'de-DE': 'EUR', 'fr-FR': 'EUR', 'lv-LV': 'EUR',
    // GBP
    'en-GB': 'GBP', 'en-gb': 'GBP', gb: 'GBP',
    // USD
    'en-US': 'USD', 'en-us': 'USD', us: 'USD',
    // CAD / AUD
    'en-CA': 'CAD', 'en-AU': 'AUD',
    // Nordics outside the euro
    sv: 'SEK', 'sv-SE': 'SEK', se: 'SEK',
    nb: 'NOK', no: 'NOK', 'nb-NO': 'NOK',
    da: 'DKK', 'da-DK': 'DKK', dk: 'DKK',
    // PL / CH
    pl: 'PLN', 'pl-PL': 'PLN',
    'de-CH': 'CHF', 'fr-CH': 'CHF', ch: 'CHF',
};

/** True when `c` is one of the operator-supported currencies. */
export function isSupportedCurrency(c: string | null | undefined): c is SupportedCurrency {
    return !!c && (SUPPORTED_CURRENCIES as readonly string[]).includes(c.toUpperCase());
}

/**
 * Map a locale string to a display currency. Tries the full locale tag
 * first (`en-GB`), then the bare language subtag (`en`). Returns
 * `undefined` when nothing matches — callers fall through to site default
 * / baseCurrency.
 */
export function currencyForLocale(locale: string | null | undefined): SupportedCurrency | undefined {
    if (!locale) return undefined;
    const tag = locale.trim();
    if (!tag) return undefined;
    // Full tag, then a normalised lang-REGION form, then bare language.
    const candidates = [tag, tag.toLowerCase(), tag.split(/[-_]/)[0]?.toLowerCase()];
    for (const c of candidates) {
        if (c && LOCALE_CURRENCY_MAP[c]) return LOCALE_CURRENCY_MAP[c];
    }
    return undefined;
}

export interface ResolveDisplayCurrencyInput {
    /** (1) Customer-set override — e.g. the `display_currency` cookie. */
    cookieCurrency?: string | null;
    /** (2) Authed customer's `IUser.preferredCurrency`. */
    userPreferred?: string | null;
    /** (3) Operator's site-default display currency. */
    siteDefault?: string | null;
    /** (4) Active storefront locale (`lv`, `en-GB`, …). */
    locale?: string | null;
    /** (5) Hard fallback — typically the product `baseCurrency`. */
    baseCurrency?: string | null;
}

/**
 * Resolve the currency a visitor should see prices in, applying the spec's
 * priority order. Every input is optional; the result is always a
 * supported currency (final fallback `'EUR'`).
 */
export function resolveDisplayCurrency(input: ResolveDisplayCurrencyInput): SupportedCurrency {
    const {cookieCurrency, userPreferred, siteDefault, locale, baseCurrency} = input;
    if (isSupportedCurrency(cookieCurrency)) return cookieCurrency.toUpperCase() as SupportedCurrency;
    if (isSupportedCurrency(userPreferred)) return userPreferred.toUpperCase() as SupportedCurrency;
    if (isSupportedCurrency(siteDefault)) return siteDefault.toUpperCase() as SupportedCurrency;
    const fromLocale = currencyForLocale(locale);
    if (fromLocale) return fromLocale;
    if (isSupportedCurrency(baseCurrency)) return baseCurrency.toUpperCase() as SupportedCurrency;
    return 'EUR';
}

export interface PickedPrice {
    /** Minor units (cents). */
    amount: number;
    /** ISO-4217 currency of `amount`. */
    currency: string;
    /**
     * True when `amount` is a native operator-published price in the
     * requested display currency. False when it's the base-currency
     * amount the caller still has to FX-convert (render with a "≈" hint).
     */
    native: boolean;
}

/**
 * Pick the price to show for `displayCurrency` from a sparse `prices` map.
 *
 *   - native hit → `{native: true}` with that amount.
 *   - no native entry → fall back to the base-currency amount (or the first
 *     available) with `{native: false}` so the caller knows to FX-convert
 *     and flag it as approximate.
 *
 * `prices` is the `ProductPrices` map; `baseCurrency` / `legacyPrice` /
 * `legacyCurrency` cover products that never got a multi-currency map.
 */
export function pickPrice(
    prices: Record<string, number> | undefined,
    displayCurrency: string,
    opts: {baseCurrency?: string | null; legacyPrice?: number | null; legacyCurrency?: string | null} = {},
): PickedPrice | null {
    const want = (displayCurrency || '').toUpperCase();
    const map: Record<string, number> = {};
    if (prices && typeof prices === 'object') {
        for (const [k, v] of Object.entries(prices)) {
            if (typeof v === 'number' && Number.isFinite(v)) map[k.toUpperCase()] = v;
        }
    }
    // Legacy single-currency products: synthesise an entry so callers get a
    // uniform shape even when `prices` was never populated.
    if (Object.keys(map).length === 0
        && typeof opts.legacyPrice === 'number'
        && opts.legacyCurrency) {
        map[opts.legacyCurrency.toUpperCase()] = opts.legacyPrice;
    }
    if (Object.keys(map).length === 0) return null;

    if (map[want] !== undefined) return {amount: map[want], currency: want, native: true};

    const base = (opts.baseCurrency || opts.legacyCurrency || '').toUpperCase();
    if (base && map[base] !== undefined) return {amount: map[base], currency: base, native: false};

    const [firstCurrency, firstAmount] = Object.entries(map)[0]!;
    return {amount: firstAmount, currency: firstCurrency, native: false};
}
