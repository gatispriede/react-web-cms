import {useEffect, useState} from 'react';

/**
 * Bare-Proxy observable — the reactivity primitive chosen for the
 * `view-model-classes.md` rollout (decision 2026-05-02). No external
 * dependency; ~150 lines of Proxy + Set<listener>.
 *
 * Usage:
 *
 *   class PostsViewModel {
 *       posts: IPost[] = [];
 *       loading = false;
 *       constructor() { return observable(this); }
 *       async refresh() { ... }
 *   }
 *
 *   const Posts = () => {
 *       const vm = useViewModel(() => new PostsViewModel());
 *       return <Table dataSource={vm.posts} loading={vm.loading} />;
 *   };
 *
 * Semantics:
 *   - Any field assignment (`vm.loading = true`) notifies subscribers.
 *   - Methods are auto-bound — `vm.refresh` and `vm.refresh()` both work
 *     without needing `useCallback` / `useMemo`.
 *   - Nested objects are NOT deep-observed by default. Mutate by
 *     reassigning (`vm.posts = [...vm.posts, newPost]`) — same idiom
 *     React already enforces.
 *   - `useObservable(vm)` subscribes the calling component to changes
 *     on `vm` and returns the same instance so reads work transparently.
 */

const LISTENERS_KEY = Symbol('observable.listeners');

interface ObservableMeta {
    [LISTENERS_KEY]: Set<() => void>;
}

/**
 * Wrap an object so field writes notify subscribers. Idempotent — wrapping
 * an already-observable returns it unchanged.
 */
export function observable<T extends object>(target: T): T {
    if ((target as unknown as ObservableMeta)[LISTENERS_KEY]) return target;
    const listeners = new Set<() => void>();
    Object.defineProperty(target, LISTENERS_KEY, {
        value: listeners,
        enumerable: false,
        writable: false,
        configurable: false,
    });
    const proxy: T = new Proxy(target, {
        get(obj, prop, receiver) {
            const value = Reflect.get(obj, prop, receiver);
            // Auto-bind methods to the PROXY (not the raw target) so
            // `this.x = y` inside a method routes through the `set`
            // trap and notifies listeners. Binding to `obj` would
            // bypass the trap entirely — silent state update, no
            // re-render.
            if (typeof value === 'function' && prop !== 'constructor') {
                return value.bind(proxy);
            }
            return value;
        },
        set(obj, prop, value, receiver) {
            const prev = Reflect.get(obj, prop, receiver);
            if (Object.is(prev, value)) return true;
            const ok = Reflect.set(obj, prop, value, receiver);
            if (ok) {
                // Snapshot to avoid mutation-during-iteration when a
                // listener triggers another set() in the same tick.
                for (const listener of [...listeners]) {
                    try { listener(); } catch { /* swallow — one bad listener shouldn't stop others */ }
                }
            }
            return ok;
        },
    }) as T;
    return proxy;
}

/** Read the listener set off an observable. Internal — exported for tests. */
export function _listenersOf<T extends object>(obj: T): Set<() => void> | undefined {
    return (obj as unknown as ObservableMeta)[LISTENERS_KEY];
}

/**
 * Subscribe the calling component to observable mutations. Returns the
 * same instance so the component reads through it transparently.
 *
 * The hook re-renders on EVERY field write — no field-level subscription
 * tracking. For the typical view-model (a dozen fields, one component
 * per VM, mutations only inside vm methods) the redraw cost is identical
 * to a plain `useState` set.
 */
export function useObservable<T extends object>(obj: T): T {
    const [, force] = useState(0);
    useEffect(() => {
        const listeners = _listenersOf(obj);
        if (!listeners) return;
        const listener = () => force(n => n + 1);
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    }, [obj]);
    return obj;
}

/**
 * Construct a view-model once per component lifetime and subscribe to
 * its mutations. The `factory` runs once on mount; subsequent renders
 * see the same instance.
 *
 * Use this over `useState(() => new VM())` because:
 *   - It calls `observable(vm)` for you.
 *   - It wires `useObservable` automatically.
 *   - The instance is stable across renders without React.memo gymnastics.
 */
export function useViewModel<T extends object>(factory: () => T): T {
    const [vm] = useState(() => observable(factory()));
    return useObservable(vm);
}
