/**
 * Cross-component refresh pub/sub. Every content-rendering UI class exposes
 * a `refreshView()` method and subscribes to this bus on mount. Any
 * mutation call site emits a topic once the server acks — all listening
 * views re-fetch in parallel, keeping the admin in a consistent state
 * without each mutation needing to know every consumer.
 *
 * Topic conventions (keep the list short — broader topics mean fewer
 * missed refreshes):
 *  - 'content'   navigation, sections, section items
 *  - 'settings'  theme, logo, footer, flags, SEO, posts, languages
 *  - 'assets'    image library
 * `undefined` / no topic = refresh everything.
 *
 * NOTE: this file is intentionally React-free. The hook variant lives in
 * `useRefreshView.ts` (marked `"use client"`) — splitting the two keeps
 * the server-reachable `services/api/client/*.ts` import chain
 * (which runs through `authOptions.ts` → `app/layout.tsx` RSC) free of
 * `useEffect`, otherwise the app-router build fails with "module that
 * depends on `useEffect` into a React Server Component module".
 */
export type RefreshTopic = 'content' | 'settings' | 'assets';

export type RefreshHandler = () => void | Promise<void>;

interface Entry {topic?: RefreshTopic; fn: RefreshHandler}

class RefreshBus {
    private subs: Entry[] = [];

    emit(topic?: RefreshTopic): void {
        const snapshot = this.subs.slice();
        for (const entry of snapshot) {
            if (!topic || !entry.topic || entry.topic === topic) {
                try {
                    void entry.fn();
                } catch (err) {
                    console.error('[refreshBus] handler threw:', err);
                }
            }
        }
    }

    subscribe(fn: RefreshHandler, topic?: RefreshTopic): () => void {
        const entry: Entry = {fn, topic};
        this.subs.push(entry);
        return () => { this.subs = this.subs.filter(e => e !== entry); };
    }

    size(): number { return this.subs.length; }
}

export const refreshBus = new RefreshBus();
