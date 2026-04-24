import {useEffect} from 'react';

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
 */
export type RefreshTopic = 'content' | 'settings' | 'assets';

type Handler = () => void | Promise<void>;

interface Entry {topic?: RefreshTopic; fn: Handler}

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

    subscribe(fn: Handler, topic?: RefreshTopic): () => void {
        const entry: Entry = {fn, topic};
        this.subs.push(entry);
        return () => { this.subs = this.subs.filter(e => e !== entry); };
    }

    size(): number { return this.subs.length; }
}

export const refreshBus = new RefreshBus();

/** Hook variant for functional components. Pass a stable fn (useCallback) or it'll re-subscribe on every render. */
export function useRefreshView(fn: Handler, topic?: RefreshTopic): void {
    useEffect(() => refreshBus.subscribe(fn, topic), [fn, topic]);
}
