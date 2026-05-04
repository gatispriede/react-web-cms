import {message} from 'antd';
import TrashApi, {type TrashGroupSummary} from '@services/api/client/TrashApi';
import {observable} from '@client/lib/state/observable';

/** VM4 — Trash admin pane (no useState). F2 / data-integrity.md. */
export class TrashViewModel {
    groups: TrashGroupSummary[] = [];
    loading = false;
    restoring: Record<string, boolean> = {};

    constructor(private readonly api: TrashApi = new TrashApi()) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.groups = await this.api.list();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            this.loading = false;
        }
    }

    async restore(trashGroup: string): Promise<void> {
        this.restoring = {...this.restoring, [trashGroup]: true};
        try {
            const res = await this.api.restore(trashGroup);
            if (res?.error) {
                message.error(res.error);
                return;
            }
            const total = Object.values(res?.counts ?? {}).reduce((a, b) => a + (b ?? 0), 0);
            message.success(`Restored ${total} row${total === 1 ? '' : 's'}`);
            await this.refresh();
        } finally {
            const next = {...this.restoring};
            delete next[trashGroup];
            this.restoring = next;
        }
    }

    /** Age of a trash group in human-readable form (`<24h` cap implicit via TTL). */
    static ageLabel(deletedAt: string): string {
        try {
            const ms = Date.now() - new Date(deletedAt).getTime();
            if (!Number.isFinite(ms) || ms < 0) return '';
            const min = Math.floor(ms / 60_000);
            if (min < 1) return 'just now';
            if (min < 60) return `${min}m ago`;
            const h = Math.floor(min / 60);
            if (h < 24) return `${h}h ago`;
            return `${Math.floor(h / 24)}d ago`;
        } catch {
            return '';
        }
    }

    static summarise(summary: Record<string, number>): string {
        const parts = Object.entries(summary || {}).map(([k, v]) => `${k}: ${v}`);
        return parts.length === 0 ? '—' : parts.join(', ');
    }
}
