import {useEffect, useState} from 'react';
import SiteFlagsApi from '@services/api/client/SiteFlagsApi';

/**
 * Small client-side hook that reads `commerce.*` site-flags via the
 * existing `SiteFlagsApi`. SSR-safe — returns the off-by-default
 * snapshot until the first client-side fetch resolves, so server
 * markup never accidentally exposes commerce UI it should hide.
 *
 * Caches the resolved snapshot in a module-level promise so multiple
 * mounted consumers (BuyCta, CartDrawer, header toggle) share one
 * roundtrip per page view rather than fanning out.
 */
export interface ICommerceFlagsSnapshot {
    checkoutEnabled: boolean;
}

const DEFAULT_SNAPSHOT: ICommerceFlagsSnapshot = {checkoutEnabled: false};

let cached: Promise<ICommerceFlagsSnapshot> | null = null;

function load(): Promise<ICommerceFlagsSnapshot> {
    if (cached) return cached;
    cached = (async () => {
        try {
            const flags = await new SiteFlagsApi().get();
            const commerce = (flags as {commerce?: Record<string, unknown>})?.commerce ?? {};
            return {
                checkoutEnabled: commerce.checkoutEnabled === true,
            };
        } catch {
            return DEFAULT_SNAPSHOT;
        }
    })();
    return cached;
}

/** Test seam — drop the cached snapshot between specs. */
export function _resetCommerceFlagsCache(): void { cached = null; }

export function useCommerceFlags(): ICommerceFlagsSnapshot {
    const [snapshot, setSnapshot] = useState<ICommerceFlagsSnapshot>(DEFAULT_SNAPSHOT);
    useEffect(() => {
        let alive = true;
        void load().then(s => { if (alive) setSnapshot(s); });
        return () => { alive = false; };
    }, []);
    return snapshot;
}
