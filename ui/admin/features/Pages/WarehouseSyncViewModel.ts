/**
 * Phase 1.C — WarehouseSyncPanel state.
 *
 * Backed by the MCP `pages.warehouseSync.*` tools (see
 * `services/features/Mcp/tools/warehouseSync.ts`). All mutating actions
 * route through `notifyPromise` so Sonner renders loading + success +
 * failure in one go.
 *
 * No `useState` (VM4 — admin features use the observable proxy).
 */
import {observable} from '@client/lib/state/observable';
import {notifyError, notifyPromise} from '@admin/lib/notify';

/** Per-page outcome from a sync (matches the MCP `SyncResult` shape). */
export interface SyncPerPage {
    slug: string;
    outcome: 'created' | 'updated' | 'soft-deleted' | 'skipped-operator-edited';
    reason?: string;
}

export interface SyncResultLike {
    adapterId: string;
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    created: number;
    updated: number;
    softDeleted: number;
    skippedOperatorEdited: number;
    errors: number;
    dryRun?: boolean;
    perPage?: SyncPerPage[];
}

/** Predefined filter set for the dry-run preview's per-page list. */
export const PER_PAGE_OUTCOME_OPTIONS: ReadonlyArray<{value: SyncPerPage['outcome']; label: string}> = [
    {value: 'created', label: 'Created'},
    {value: 'updated', label: 'Updated'},
    {value: 'soft-deleted', label: 'Soft-deleted'},
    {value: 'skipped-operator-edited', label: 'Skipped (operator-edited)'},
];

export class WarehouseSyncViewModel {
    lastStatus: SyncResultLike | null = null;
    previewResults: SyncResultLike[] = [];
    syncing = false;
    previewing = false;
    depthWarningAt = 8;
    /** Filter applied to the preview's per-page list. */
    outcomeFilter: SyncPerPage['outcome'] | 'all' = 'all';

    constructor() {
        return observable(this);
    }

    setOutcomeFilter(v: SyncPerPage['outcome'] | 'all'): void {
        this.outcomeFilter = v;
    }

    /** Call MCP `pages.warehouseSync.status` to fetch the last result. */
    async refresh(): Promise<void> {
        try {
            const res = await callMcp('pages.warehouseSync.status', {});
            if (res?.found && res.last) this.lastStatus = res.last as SyncResultLike;
        } catch (err) {
            notifyError('Status read failed', err);
        }
    }

    /** Manually trigger a sync. Wraps in `notifyPromise` so the toast
     *  surfaces the new counts on success. */
    async syncNow(): Promise<void> {
        if (this.syncing) return;
        this.syncing = true;
        await notifyPromise(
            (async () => {
                const res = await callMcp('pages.warehouseSync.run', {});
                const first = res?.results?.[0];
                if (first) this.lastStatus = first as SyncResultLike;
                return res;
            })(),
            {
                loading: 'Syncing warehouse pages…',
                success: () => `Sync complete — created ${this.lastStatus?.created ?? 0}, updated ${this.lastStatus?.updated ?? 0}`,
                error: 'Sync failed',
            },
        );
        this.syncing = false;
    }

    /** Dry-run preview — does not write. */
    async preview(): Promise<void> {
        if (this.previewing) return;
        this.previewing = true;
        try {
            const res = await callMcp('pages.warehouseSync.preview', {dryRun: true});
            this.previewResults = (res?.results ?? []) as SyncResultLike[];
        } catch (err) {
            notifyError('Preview failed', err);
        }
        this.previewing = false;
    }

    /** Filtered per-page rows for the preview table. */
    get filteredPerPage(): SyncPerPage[] {
        const all = this.previewResults.flatMap(r => r.perPage ?? []);
        if (this.outcomeFilter === 'all') return all;
        return all.filter(p => p.outcome === this.outcomeFilter);
    }
}

/**
 * Helper — fetch through the existing MCP runner endpoint. The admin
 * shell already has an MCP gateway at `/api/mcp`; we POST a single tool
 * call and wait for the envelope.
 */
async function callMcp(tool: string, args: Record<string, unknown>): Promise<any> {
    const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({tool, args}),
    });
    if (!res.ok) throw new Error(`MCP ${tool} failed: ${res.status}`);
    return res.json();
}
