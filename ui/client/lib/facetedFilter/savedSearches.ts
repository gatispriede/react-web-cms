/**
 * Saved-search store — the customer-facing side of the faceted-filter
 * system's "save this search + get alerts" capability.
 *
 * Storage: `localStorage`, keyed per list slug. This chunk ships the
 * client store + the `SaveSearchPrompt` integration; a server-backed
 * `ISavedSearch` collection + alert worker + the canonical MCP write
 * path (`services/features/Mcp/tools/savedSearch.ts`) land with the
 * signup / customer-account roadmap item (saved searches require
 * customer auth — see the dependency note in the spec). Until then the
 * store degrades gracefully to in-memory when `localStorage` throws
 * (privacy modes), and `SavedSearchList` (`/account/searches`) reads the
 * same shape so the surface is wired end-to-end.
 *
 * Keeping the read/write surface here (one module, one shape) means the
 * server swap is a single-file change — callers stay untouched.
 */
import type {ISavedSearch} from './types';

const STORAGE_PREFIX = 'facetedFilter.savedSearches.';

/** In-memory fallback when localStorage is unavailable (Safari private). */
const memoryStore = new Map<string, ISavedSearch[]>();

function storageKey(listSlug: string): string {
    return STORAGE_PREFIX + listSlug;
}

function readRaw(listSlug: string): ISavedSearch[] {
    if (typeof window === 'undefined') return memoryStore.get(listSlug) ?? [];
    try {
        const raw = window.localStorage.getItem(storageKey(listSlug));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as ISavedSearch[]) : [];
    } catch {
        return memoryStore.get(listSlug) ?? [];
    }
}

function writeRaw(listSlug: string, rows: ISavedSearch[]): void {
    memoryStore.set(listSlug, rows);
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(storageKey(listSlug), JSON.stringify(rows));
    } catch {
        // Privacy-mode / quota — the in-memory copy above keeps the session consistent.
    }
}

/** All saved searches for one list, newest first. */
export function listSavedSearches(listSlug: string): ISavedSearch[] {
    return [...readRaw(listSlug)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Persist a new saved search. Returns the stored record. */
export function addSavedSearch(input: {listSlug: string; title: string; filterQuery: string}): ISavedSearch {
    const record: ISavedSearch = {
        id: `ss_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        listSlug: input.listSlug,
        title: input.title.trim() || 'Untitled search',
        filterQuery: input.filterQuery,
        createdAt: new Date().toISOString(),
    };
    const rows = readRaw(input.listSlug);
    rows.push(record);
    writeRaw(input.listSlug, rows);
    return record;
}

/** Remove one saved search by id. */
export function removeSavedSearch(listSlug: string, id: string): void {
    writeRaw(listSlug, readRaw(listSlug).filter(r => r.id !== id));
}
