/**
 * Polish bundle (W8g follow-up) — customer-facing currency switcher.
 *
 * Dropdown the site shell mounts in the header/footer. Persists choice
 * to a same-origin cookie (`display_currency`, 365 days, SameSite=Lax)
 * so SSR can read it on next navigation and price modules can render
 * the right native string.
 *
 * Source-of-truth for the option list is `SUPPORTED_CURRENCIES` from
 * the pricing schema — adding a currency upstream automatically
 * surfaces it here (no free-text input, per project policy).
 *
 * The switcher is intentionally a thin "set my display currency"
 * affordance — it does NOT change cart totals or trigger a re-quote.
 * Final transaction currency is locked at checkout per the
 * `multi-currency-and-tax.md` spec. `PriceDisplay` consumes the cookie
 * value via the `useDisplayCurrency()` hook.
 */
import React, {useCallback, useEffect, useState} from 'react';
import {SUPPORTED_CURRENCIES, type SupportedCurrency} from '@interfaces/IPricing';

const COOKIE_NAME = 'display_currency';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

function readCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=${encodeURIComponent(value)};max-age=${COOKIE_MAX_AGE};path=/;samesite=lax`;
}

export function useDisplayCurrency(defaultCurrency: SupportedCurrency = 'EUR'): {
    currency: SupportedCurrency;
    set: (c: SupportedCurrency) => void;
} {
    const [currency, setState] = useState<SupportedCurrency>(defaultCurrency);
    useEffect(() => {
        const stored = readCookie(COOKIE_NAME);
        if (stored && (SUPPORTED_CURRENCIES as readonly string[]).includes(stored)) {
            setState(stored as SupportedCurrency);
        }
    }, []);
    const set = useCallback((c: SupportedCurrency): void => {
        writeCookie(COOKIE_NAME, c);
        setState(c);
        // Inform other mounted instances (header + footer) in the
        // current tab — the cookie alone won't trigger React updates.
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('display-currency-change', {detail: c}));
        }
    }, []);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handler = (e: Event): void => {
            const next = (e as CustomEvent<SupportedCurrency>).detail;
            if (next && next !== currency) setState(next);
        };
        window.addEventListener('display-currency-change', handler as EventListener);
        return () => window.removeEventListener('display-currency-change', handler as EventListener);
    }, [currency]);
    return {currency, set};
}

export interface CurrencySwitcherProps {
    /** Restrict the dropdown to the operator-enabled list (from SiteFlags). */
    enabledCurrencies?: SupportedCurrency[];
    /** Site-default fallback when no cookie + no client preference. */
    defaultCurrency?: SupportedCurrency;
    /** Optional className for header/footer styling slots. */
    className?: string;
}

export const CurrencySwitcher: React.FC<CurrencySwitcherProps> = ({
    enabledCurrencies,
    defaultCurrency = 'EUR',
    className,
}) => {
    const {currency, set} = useDisplayCurrency(defaultCurrency);
    const options = (enabledCurrencies && enabledCurrencies.length > 0)
        ? enabledCurrencies
        : (SUPPORTED_CURRENCIES as readonly SupportedCurrency[]);
    return (
        <label className={className} data-testid="currency-switcher-label">
            <span className="visually-hidden" style={{position: 'absolute', left: '-9999px'}}>Display currency</span>
            <select
                data-testid="currency-switcher"
                value={currency}
                onChange={(e) => set(e.target.value as SupportedCurrency)}
                aria-label="Display currency"
                style={{
                    background: 'transparent',
                    border: '1px solid currentColor',
                    borderRadius: 4,
                    padding: '2px 6px',
                    color: 'inherit',
                    cursor: 'pointer',
                }}
            >
                {options.map((c) => (
                    <option key={c} value={c} data-testid={`currency-switcher-option-${c}`}>
                        {c}
                    </option>
                ))}
            </select>
        </label>
    );
};

export default CurrencySwitcher;
