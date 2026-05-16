"use client";
import {useEffect} from 'react';
import {refreshBus, type RefreshHandler, type RefreshTopic} from './refreshBus';

/**
 * Hook variant of `refreshBus.subscribe()` for functional components.
 *
 * Pass a stable `fn` (wrap in `useCallback`) or it'll re-subscribe on every
 * render. Lives in its own `"use client"` module so the React-free
 * `refreshBus.ts` can be imported by server-reachable `services/api/client/*.ts`
 * without dragging `useEffect` into the RSC graph (see refreshBus.ts header).
 */
export function useRefreshView(fn: RefreshHandler, topic?: RefreshTopic): void {
    useEffect(() => refreshBus.subscribe(fn, topic), [fn, topic]);
}
