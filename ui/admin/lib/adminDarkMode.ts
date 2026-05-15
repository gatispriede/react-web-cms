import {useEffect, useState} from 'react';

/**
 * Admin dark-mode resolution + persistence.
 * Per `docs/roadmap/admin/admin-dark-mode-audit.md`.
 *
 * Mirrors the `adminMode.ts` pattern: a module-scoped value + subscriber
 * set so every admin component that cares about the mode (the top-bar
 * `DarkModeSwitcher` toggle AND `AdminApp`'s `ConfigProvider`) shares one
 * source of truth and re-renders together. Without this, flipping the
 * toggle stamped `data-admin-theme` but `AdminApp`'s algorithm prop never
 * re-evaluated — dark mode only "took" after a full reload.
 *
 * Source of truth: localStorage `admin.darkMode` (`'1'` / `'0'`).
 * Side effect of every change: stamp `data-admin-theme` on
 * `documentElement` so the `AdminDarkMode.scss` chrome overrides flip in
 * lockstep with the AntD `ConfigProvider` algorithm swap.
 *
 * Cross-tab: a `storage` listener (installed once, lazily) keeps every
 * open admin tab in sync when the toggle flips in any one of them.
 */

const STORAGE_KEY = 'admin.darkMode';

let cachedDark: boolean | null = null;
const subscribers = new Set<() => void>();
let storageListenerInstalled = false;

function notify(): void {
    for (const sub of [...subscribers]) {
        try { sub(); } catch { /* ignore */ }
    }
}

/** Stamp the document so non-AntD admin chrome SCSS can flip via the
 *  `[data-admin-theme="dark"]` selector. No-op during SSR. */
function applyAttribute(on: boolean): void {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-admin-theme', on ? 'dark' : 'light');
}

function readSaved(): boolean {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
}

function ensureStorageListener(): void {
    if (storageListenerInstalled || typeof window === 'undefined') return;
    storageListenerInstalled = true;
    window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key !== STORAGE_KEY) return;
        const next = e.newValue === '1';
        cachedDark = next;
        applyAttribute(next);
        notify();
    });
}

/** Synchronous read for non-hook callers (e.g. `AdminApp` initial state).
 *  Primes the cache + document attribute from localStorage on first call. */
export function getCachedDarkMode(): boolean {
    if (cachedDark === null) {
        cachedDark = readSaved();
        applyAttribute(cachedDark);
    }
    return cachedDark;
}

/** Flip dark mode. Persists to localStorage, stamps the document, and
 *  notifies every subscriber so the toggle + `ConfigProvider` re-render
 *  together — no reload needed. */
export function setAdminDarkMode(on: boolean): void {
    cachedDark = on;
    applyAttribute(on);
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    }
    notify();
}

/**
 * Plain (non-hook) subscription for class components — `AdminApp` uses
 * this to keep its `ConfigProvider` algorithm in lockstep with the
 * top-bar toggle. Primes the cache + `storage` listener on first call,
 * fires `cb` on every change, and returns an unsubscribe.
 */
export function subscribeAdminDarkMode(cb: () => void): () => void {
    ensureStorageListener();
    getCachedDarkMode();
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
}

/**
 * Subscribe a component to dark-mode changes. Returns the current value
 * + a setter. Re-renders on any `setAdminDarkMode` call (this tab) or
 * `storage` event (other tabs).
 */
export function useAdminDarkMode(): {dark: boolean; setDark: (on: boolean) => void} {
    const [dark, setDarkState] = useState<boolean>(() => getCachedDarkMode());

    useEffect(() => {
        ensureStorageListener();
        const subscriber = () => setDarkState(getCachedDarkMode());
        subscribers.add(subscriber);
        // Reconcile against localStorage in case it changed between the
        // module-eval cache prime and this mount.
        subscriber();
        return () => { subscribers.delete(subscriber); };
    }, []);

    return {dark, setDark: setAdminDarkMode};
}
