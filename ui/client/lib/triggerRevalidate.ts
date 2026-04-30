/**
 * Client helper for firing on-demand ISR from admin mutations.
 *
 * Every content-changing admin flow (theme save, section save, nav
 * rename, post publish, …) calls one of these after the mutation acks.
 * The helper:
 *   - POSTs to `/api/revalidate` with the shared token
 *   - runs fire-and-forget (never blocks UI feedback on ISR completion)
 *   - swallows failures to a `console.warn` so a misconfigured preview
 *     environment doesn't break the save flow
 *
 * Auth: the admin browser is already authenticated via NextAuth. The
 * endpoint validates `sessionFromReq` → `editor`-or-above, so no token
 * plumbing is needed in the client bundle. Same-origin cookies ride
 * along automatically (credentials: 'same-origin' is the fetch default
 * for same-origin requests, but we set it explicitly for clarity).
 */

type Scope =
    | {scope: 'all'}
    | {scope: 'page'; pageName: string}
    | {scope: 'post'; slug: string}
    | {scope: 'blog'}
    | {scope: 'product'; slug: string}
    | {scope: 'products'}
    | {paths: string[]};

export function triggerRevalidate(scope: Scope): void {
    if (typeof window === 'undefined') return; // no-op during SSR
    // Fire and forget — ISR regeneration is a server-side background
    // concern; the admin user's save flow shouldn't wait on it.
    fetch('/api/revalidate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify(scope),
        keepalive: true,
    }).then((r) => {
        if (!r.ok) console.warn('[revalidate] server rejected', r.status);
    }).catch((err) => {
        console.warn('[revalidate] network error', err);
    });
}
