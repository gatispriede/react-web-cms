import {useEffect, useState} from 'react';

/**
 * `useIsMobile` — React hook that flips when the viewport crosses the
 * admin mobile breakpoint. Backs the drawer-mode shell, the editor row
 * collapse, the modal-as-bottom-sheet treatment, and any other
 * conditional render that needs "are we on a phone right now?"
 *
 * The breakpoint is **768 px** per Wave 1 D2 — iOS HIG's standard
 * phone/tablet boundary. Public-side `MobileNav` uses 980 px because
 * its drawer pattern triggers earlier; admin keeps a tighter threshold
 * so tablets in landscape stay on the desktop layout.
 *
 * SSR-safe: starts as `false` (desktop) on the server so the first
 * client paint matches what's coming from `getServerSideProps` /
 * static export, then re-evaluates on mount via `matchMedia`. Avoids
 * the hydration mismatch that would otherwise fire when the page first
 * renders on a mobile device.
 *
 * Listens via `MediaQueryList.change` so resizes / device-orientation
 * flips re-trigger without a manual rerender.
 */
const ADMIN_MOBILE_BREAKPOINT_PX = 768;

export function useIsMobile(breakpoint: number = ADMIN_MOBILE_BREAKPOINT_PX): boolean {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
        // Initial sync — client may already be below the breakpoint.
        setIsMobile(mql.matches);
        const listener = (e: MediaQueryListEvent): void => setIsMobile(e.matches);
        // Older Safari uses the deprecated `addListener`; modern browsers
        // expose `addEventListener('change', …)`. Try both for safety.
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', listener);
            return () => mql.removeEventListener('change', listener);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (mql as any).addListener(listener);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return () => (mql as any).removeListener(listener);
    }, [breakpoint]);
    return isMobile;
}

export {ADMIN_MOBILE_BREAKPOINT_PX};
