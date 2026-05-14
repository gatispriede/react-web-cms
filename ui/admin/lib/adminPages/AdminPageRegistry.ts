/**
 * admin-module-composed — `AdminPageRegistry`.
 *
 * Admin-side analogue of the customer `SystemPageRegistry`. Each
 * in-scope admin pane's `AdminLoader` (the bridge) registers here as a
 * module-load side-effect; `AdminPageDispatch` looks the loader up by
 * `paneId` and renders its bridge.
 *
 * Admin-client-only — never imported by server boot or the public
 * bundle (mirrors how `adminUILoaderRegistry.ts` is admin-only).
 */
import type {AdminLoader} from './AdminLoader';

class AdminPageRegistry {
    private loaders = new Map<string, AdminLoader>();

    /** Register a pane's bridge. Throws on a duplicate `paneId` so two
     *  features can't silently fight over the same admin route. */
    register(loader: AdminLoader): void {
        if (!loader || typeof loader.paneId !== 'string' || loader.paneId.length === 0) {
            throw new Error('AdminPageRegistry.register: paneId is required');
        }
        if (this.loaders.has(loader.paneId)) {
            throw new Error(`AdminPageRegistry.register: duplicate paneId "${loader.paneId}"`);
        }
        this.loaders.set(loader.paneId, loader);
    }

    /** Resolve a pane's bridge by id, or `null` when the pane isn't
     *  module-composed yet (the shell falls back to the legacy pane). */
    get(paneId: string): AdminLoader | null {
        return this.loaders.get(paneId) ?? null;
    }

    /** Snapshot of every registered bridge. */
    list(): readonly AdminLoader[] {
        return Array.from(this.loaders.values());
    }

    /** Test-only — reset between suites so duplicate-registration paths
     *  can be exercised without leaking state across files. */
    _resetForTests(): void {
        this.loaders.clear();
    }
}

/** Runtime singleton — admin `AdminLoader`s register against this. */
export const adminPageRegistry = new AdminPageRegistry();
export {AdminPageRegistry};
