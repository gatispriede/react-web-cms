import {useEffect} from 'react';
import {usePathname, useSearchParams} from 'next/navigation';
import {trackPageview} from './track';

/**
 * Auto-pageview hook — calls `trackPageview()` on every route change.
 * Mount once (in `app/providers.tsx` via `AnalyticsHost`) and forget.
 * Cheap; respects the privacy opt-out built into `track.ts`.
 *
 * Pages Router predecessor used `router.events.on('routeChangeComplete')`.
 * App Router has no event bus; instead we watch `usePathname()` +
 * `useSearchParams()` and fire on change. The first pageview also fires
 * on mount.
 */
export function useAutoPageview(): void {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    useEffect(() => {
        const path = searchParams && searchParams.toString()
            ? `${pathname}?${searchParams.toString()}`
            : (pathname ?? '');
        trackPageview(path);
    }, [pathname, searchParams]);
}
