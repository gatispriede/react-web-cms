import {useEffect, useState} from 'react';

/**
 * Storefront-side fetcher for `siteFlags.auth.*`. Components in this
 * folder early-return `null` when `clientLoginEnabled === false` so
 * the bundle still ships but renders nothing on the no-auth site.
 *
 * Source of truth is the `/api/site/auth-flags` endpoint
 * (`audience: 'public-readable'` registrations from
 * `services/features/Auth/authFlags.ts`). The hook caches per-tab in
 * `sessionStorage` for 30s to match the middleware cache.
 */

export interface AuthFlagsState {
    clientLoginEnabled: boolean;
    providerMagicLink: boolean;
    providerCredentials: boolean;
    providerGoogle: boolean;
    providerFacebook: boolean;
    providerApple: boolean;
    loaded: boolean;
}

const STORAGE_KEY = 'cms.authFlags.v1';
const TTL_MS = 30_000;

const DEFAULTS: AuthFlagsState = {
    clientLoginEnabled: false,
    providerMagicLink: true,
    providerCredentials: false,
    providerGoogle: false,
    providerFacebook: false,
    providerApple: false,
    loaded: false,
};

function readCache(): AuthFlagsState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as {at: number; v: AuthFlagsState};
        if (Date.now() - parsed.at > TTL_MS) return null;
        return {...parsed.v, loaded: true};
    } catch {
        return null;
    }
}

function writeCache(v: AuthFlagsState): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({at: Date.now(), v}));
    } catch { /* QuotaExceeded — degrade quietly */ }
}

export function useAuthFlags(): AuthFlagsState {
    const [state, setState] = useState<AuthFlagsState>(() => readCache() ?? DEFAULTS);
    useEffect(() => {
        let cancelled = false;
        if (state.loaded) return;
        fetch('/api/site/auth-flags').then(async (res) => {
            if (!res.ok) return;
            const data = await res.json();
            const next: AuthFlagsState = {
                clientLoginEnabled: Boolean(data.clientLoginEnabled),
                providerMagicLink: Boolean(data.providerMagicLink),
                providerCredentials: Boolean(data.providerCredentials),
                providerGoogle: Boolean(data.providerGoogle),
                providerFacebook: Boolean(data.providerFacebook),
                providerApple: Boolean(data.providerApple),
                loaded: true,
            };
            writeCache(next);
            if (!cancelled) setState(next);
        }).catch(() => undefined);
        return () => {cancelled = true;};
    }, [state.loaded]);
    return state;
}
