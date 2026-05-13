import {observable} from '@client/lib/state/observable';

export interface AttributionRow {
    key: string;
    hits: number;
    signups: number;
    orders: number;
    lastSeen?: string;
}

/**
 * W6c — admin attribution VM. `useState` is banned in admin features
 * (eslint VM4 rule) so all state lives here, wrapped with `observable()`
 * so the panel re-renders on assignment.
 */
export class AttributionViewModel {
    rows: AttributionRow[] = [];
    total = 0;
    loading = false;
    disabled = false;
    groupBy: 'source' | 'campaign' | 'ref' = 'source';
    range: '7d' | '30d' | '90d' | 'all' = '30d';

    constructor() { return observable(this); }

    setGroupBy(g: 'source' | 'campaign' | 'ref'): void {
        this.groupBy = g;
        void this.refresh();
    }

    setRange(r: '7d' | '30d' | '90d' | 'all'): void {
        this.range = r;
        void this.refresh();
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            const range = this.range === 'all' ? '36500d' : this.range;
            const r = await fetch(`/api/admin/marketing-attribution?groupBy=${this.groupBy}&range=${range}`, {credentials: 'same-origin'});
            if (!r.ok) {
                this.rows = [];
                this.total = 0;
                return;
            }
            const data = await r.json();
            this.disabled = Boolean(data?.disabled);
            this.rows = Array.isArray(data?.rows) ? data.rows : [];
            this.total = typeof data?.total === 'number' ? data.total : 0;
        } catch {
            this.rows = [];
            this.total = 0;
        } finally {
            this.loading = false;
        }
    }
}
