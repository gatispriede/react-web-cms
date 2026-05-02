import {useEffect, useState} from 'react';

/**
 * Admin UI mode resolution + per-user setter.
 * Per `docs/features/platform/admin-ui-modes.md` (decisions 2026-05-02).
 *
 * The hook fetches `mongo.myAdminUiMode` once on mount and caches it in
 * a module-scoped value so subsequent components don't refetch.
 * `setMyAdminUiMode` is a fire-and-forget call that updates both the
 * cache and the user's stored preference; switching modes is fast and
 * doesn't block on a server round-trip for the visible state change.
 */

export type AdminUiMode = 'simplified' | 'advanced';

let cachedMode: AdminUiMode | null = null;
const subscribers = new Set<() => void>();

function notify(): void {
    for (const sub of [...subscribers]) {
        try { sub(); } catch { /* ignore */ }
    }
}

export function getCachedMode(): AdminUiMode | null {
    return cachedMode;
}

async function fetchModeFromServer(): Promise<AdminUiMode> {
    try {
        const r = await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query: `{ mongo { myAdminUiMode } }`}),
        });
        const json = await r.json();
        const raw = json?.data?.mongo?.myAdminUiMode;
        if (raw === 'simplified' || raw === 'advanced') return raw;
        return 'advanced';
    } catch {
        return 'advanced';
    }
}

export async function setAdminUiMode(mode: AdminUiMode): Promise<void> {
    cachedMode = mode;
    notify();
    try {
        await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: `mutation Set($mode: String!) { mongo { setMyAdminUiMode(mode: $mode) } }`,
                variables: {mode},
            }),
        });
    } catch {
        // Optimistic update — failure leaves the cache as-is so the
        // user keeps their chosen mode for the session even if the
        // persist failed.
    }
}

/**
 * Subscribe a component to mode changes. Returns the current mode +
 * a setter that updates both cache and server. Re-renders on any
 * `setAdminUiMode` call.
 */
export function useAdminMode(): {mode: AdminUiMode | null; setMode: (m: AdminUiMode) => Promise<void>} {
    const [mode, setMode] = useState<AdminUiMode | null>(cachedMode);

    useEffect(() => {
        const subscriber = () => setMode(cachedMode);
        subscribers.add(subscriber);
        if (cachedMode === null) {
            void fetchModeFromServer().then(m => {
                cachedMode = m;
                notify();
            });
        }
        return () => { subscribers.delete(subscriber); };
    }, []);

    return {mode, setMode: setAdminUiMode};
}
