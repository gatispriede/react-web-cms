/**
 * Wave 8b — Compliance admin VM. Reads pending deletions + sweep stats,
 * exposes admin actions through the `/api/admin/compliance` endpoint.
 *
 * Per project policy (`feedback_coding_principles`) the VM uses
 * `observable()` rather than React `useState`. notifyPromise for the
 * long-running sweep so the operator sees loading + success/fail toast.
 */
import {notifyError, notifyPromise, notifySuccess} from '@admin/lib/notify';
import {observable} from '@client/lib/state/observable';

export interface DeletionRow {
    id: string;
    userId: string;
    email?: string;
    requestedAt: string;
    scheduledFor: string;
    status: 'pending' | 'cancelled' | 'purged';
    trashGroup?: string;
}

interface SweepStats {
    purgedDeletions: number;
    sweptCollections: Array<{coll: string; removed: number}>;
}

async function fetchPending(limit: number): Promise<{rows: DeletionRow[]; lastSweep: string | null}> {
    const r = await fetch(`/api/admin/compliance?view=deletions&limit=${limit}`, {credentials: 'same-origin'});
    if (!r.ok) throw new Error(`Compliance fetch failed: ${r.status}`);
    const j = await r.json();
    return {rows: Array.isArray(j?.rows) ? j.rows : [], lastSweep: j?.lastSweepAt ?? null};
}

async function postAction(body: Record<string, unknown>): Promise<SweepStats | {ok: boolean}> {
    const r = await fetch('/api/admin/compliance', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        credentials: 'same-origin',
        body: JSON.stringify(body),
    });
    if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || `Request failed: ${r.status}`);
    }
    return r.json();
}

export class CompliancePanelViewModel {
    deletions: DeletionRow[] = [];
    lastSweep: string | null = null;
    loading = false;
    busy = false;
    limit = 100;

    constructor(private readonly t: (k: string, opts?: Record<string, unknown>) => string = (k) => k) {
        return observable(this);
    }

    setLimit(n: number): void {
        this.limit = n;
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            const {rows, lastSweep} = await fetchPending(this.limit);
            this.deletions = rows;
            this.lastSweep = lastSweep ? new Date(lastSweep).toLocaleString() : null;
        } catch (err) {
            notifyError(err);
        } finally {
            this.loading = false;
        }
    }

    async runSweep(): Promise<void> {
        this.busy = true;
        try {
            const result = await notifyPromise(
                postAction({action: 'retention-sweep'}) as Promise<SweepStats>,
                {
                    loading: this.t('compliance.sweep.loading', {defaultValue: 'Running retention sweep…'}),
                    success: (r) => this.t('compliance.sweep.success', {
                        defaultValue: 'Swept {{rows}} rows; purged {{purged}} deletions',
                        rows: r.sweptCollections.reduce((a, c) => a + c.removed, 0),
                        purged: r.purgedDeletions,
                    }),
                    error: (e) => this.t('compliance.sweep.error', {defaultValue: 'Sweep failed: {{msg}}', msg: String((e as Error)?.message ?? e)}),
                },
            );
            void result;
            await this.refresh();
        } catch (err) {
            notifyError(err);
        } finally {
            this.busy = false;
        }
    }

    async confirmDeletion(userId: string): Promise<void> {
        this.busy = true;
        try {
            await postAction({action: 'confirm-deletion', userId});
            notifySuccess(this.t('compliance.confirm.success', {defaultValue: 'Deletion confirmed'}));
            await this.refresh();
        } catch (err) {
            notifyError(err);
        } finally {
            this.busy = false;
        }
    }

    async cancelDeletion(userId: string): Promise<void> {
        this.busy = true;
        try {
            await postAction({action: 'cancel-deletion', userId});
            notifySuccess(this.t('compliance.cancel.success', {defaultValue: 'Deletion cancelled'}));
            await this.refresh();
        } catch (err) {
            notifyError(err);
        } finally {
            this.busy = false;
        }
    }
}
