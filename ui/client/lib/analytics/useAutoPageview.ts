import {useEffect} from 'react';
import {useRouter} from 'next/router';
import {trackPageview} from './track';

/**
 * Auto-pageview hook — calls `trackPageview()` on every route change.
 * Mount once (typically in `_app.tsx`) and forget. Cheap; respects the
 * privacy opt-out built into `track.ts`.
 *
 * The first pageview fires on mount; subsequent fires on `routeChangeComplete`.
 */
export function useAutoPageview(): void {
    const router = useRouter();
    useEffect(() => {
        trackPageview();
        const onRouteChange = (path: string) => trackPageview(path);
        router.events.on('routeChangeComplete', onRouteChange);
        return () => router.events.off('routeChangeComplete', onRouteChange);
    }, [router.events]);
}
