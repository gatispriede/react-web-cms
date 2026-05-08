import {useEffect, useRef, useState} from 'react';

/**
 * `usePullToRefresh` — hook that wires a touch-driven pull-to-refresh
 * gesture onto a scrollable container. Only fires on mobile (touch
 * devices). Pull threshold: 80 px past `scrollTop === 0`.
 *
 * Native iOS Safari already implements pull-to-refresh on the page
 * itself; this hook lets a *nested* scroll container (admin pane,
 * inquiry list, etc.) opt into the same gesture inside the admin SPA
 * where the page wrapper isn't the scroll surface.
 *
 * Returns `{ ref, pulling, distance }` so the host can render a
 * progress indicator while the gesture is in progress.
 *
 * Wave 1 mobile-friendly admin spec — pull-to-refresh is the kind of
 * surface-tension polish that makes mobile feel native; cheap to add,
 * surprisingly missed when absent.
 */
const PULL_THRESHOLD_PX = 80;
const RESISTANCE = 0.4;

export function usePullToRefresh(onRefresh: () => void | Promise<void>): {
    ref: (el: HTMLElement | null) => void;
    pulling: boolean;
    distance: number;
} {
    const [distance, setDistance] = useState(0);
    const [pulling, setPulling] = useState(false);
    const startYRef = useRef<number | null>(null);
    const elRef = useRef<HTMLElement | null>(null);
    const onRefreshRef = useRef(onRefresh);

    // Keep the latest callback without breaking the listeners' identity.
    useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

    useEffect(() => {
        const el = elRef.current;
        if (!el) return;

        const onStart = (e: TouchEvent): void => {
            if (el.scrollTop > 0) return;
            startYRef.current = e.touches[0].clientY;
        };

        const onMove = (e: TouchEvent): void => {
            if (startYRef.current == null) return;
            const dy = e.touches[0].clientY - startYRef.current;
            if (dy <= 0) {
                setDistance(0);
                setPulling(false);
                return;
            }
            // Apply rubber-band resistance so 80 px of pull feels weighty.
            const resisted = dy * RESISTANCE;
            setDistance(resisted);
            setPulling(true);
            // Don't preventDefault — let the user keep scrolling normally
            // if they pull past threshold then release upward. Native
            // iOS pull-to-refresh sits underneath us and is the right
            // fallback when we abort.
        };

        const onEnd = (): void => {
            const final = distance;
            startYRef.current = null;
            setDistance(0);
            setPulling(false);
            if (final >= PULL_THRESHOLD_PX) {
                void onRefreshRef.current();
            }
        };

        el.addEventListener('touchstart', onStart, {passive: true});
        el.addEventListener('touchmove', onMove, {passive: true});
        el.addEventListener('touchend', onEnd);
        el.addEventListener('touchcancel', onEnd);
        return () => {
            el.removeEventListener('touchstart', onStart);
            el.removeEventListener('touchmove', onMove);
            el.removeEventListener('touchend', onEnd);
            el.removeEventListener('touchcancel', onEnd);
        };
    }, [distance]);

    const ref = (el: HTMLElement | null): void => { elRef.current = el; };

    return {ref, pulling, distance};
}

export {PULL_THRESHOLD_PX};
