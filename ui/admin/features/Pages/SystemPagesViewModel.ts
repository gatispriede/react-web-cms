/**
 * Phase 1.D — SystemPagesPanel state.
 *
 * Backed by the MCP `systemPages.*` tools. VM4 — no useState; mutations
 * flow through `notifyPromise` / `notifyDestructive` so Sonner toasts
 * surface success + failure consistently.
 */
import {observable} from '@client/lib/state/observable';
import {notifyError, notifyPromise} from '@admin/lib/notify';

export interface SystemPageRow {
    systemKey: string;
    slug: string;
    titleI18nKey: string;
    accessGate: string;
    state: {exists: boolean; operatorEdited: boolean; pageId?: string; slug?: string};
}

export class SystemPagesViewModel {
    rows: SystemPageRow[] = [];
    loading = false;
    resettingKey: string | null = null;

    constructor() { return observable(this); }

    async refresh(): Promise<void> {
        if (this.loading) return;
        this.loading = true;
        try {
            const res = await callMcp('systemPages.list', {});
            this.rows = Array.isArray(res?.data) ? res.data as SystemPageRow[] : (Array.isArray(res) ? res as SystemPageRow[] : []);
        } catch (err) {
            notifyError(err);
        }
        this.loading = false;
    }

    async reset(systemKey: string): Promise<void> {
        if (!window.confirm(`Reset ${systemKey} to defaults? Operator-added sections will be discarded. Locked sections remain.`)) return;
        this.resettingKey = systemKey;
        try {
            await notifyPromise(
                callMcp('systemPages.reset', {systemKey}),
                {
                    loading: `Resetting ${systemKey}…`,
                    success: () => `Reset ${systemKey}`,
                    error: 'Reset failed',
                },
            );
        } finally {
            this.resettingKey = null;
            await this.refresh();
        }
    }
}

async function callMcp(tool: string, args: Record<string, unknown>): Promise<any> {
    const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({tool, args}),
    });
    if (!res.ok) throw new Error(`MCP ${tool} failed: ${res.status}`);
    return res.json();
}
