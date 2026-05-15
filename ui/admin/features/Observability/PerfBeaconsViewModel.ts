import {observable} from '@client/lib/state/observable';

export interface PerfBeacon {
    name: string;
    value: number;
    rating?: 'good' | 'needs-improvement' | 'poor';
    path: string;
    ts: number;
    userAgent?: string;
}

/**
 * VM for the W8d performance dashboard. Holds the last N RUM samples
 * plus the in-pane filter knobs (metric + limit). Per project policy
 * `useState` is banned in admin features; state lives here, wrapped
 * with `observable()` so the panel re-renders on assignment.
 */
export class PerfBeaconsViewModel {
    rows: PerfBeacon[] = [];
    loading = false;
    metric: string = 'all';
    limit: number = 200;

    constructor() { return observable(this); }

    setMetric(m: string): void {
        this.metric = m;
    }

    setLimit(n: number): void {
        this.limit = n;
        void this.refresh();
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            const r = await fetch(`/api/admin/perf-beacons?limit=${this.limit}`, {credentials: 'same-origin'});
            if (!r.ok) {
                this.rows = [];
                return;
            }
            const data = await r.json();
            this.rows = Array.isArray(data?.rows) ? data.rows : [];
        } catch {
            this.rows = [];
        } finally {
            this.loading = false;
        }
    }

    get filtered(): PerfBeacon[] {
        return this.metric === 'all' ? this.rows : this.rows.filter(r => r.name === this.metric);
    }

    /** p50 / p75 / p95 per metric across the visible window. */
    get summary(): Array<{name: string; count: number; p50: number | null; p75: number | null; p95: number | null}> {
        const groups = new Map<string, number[]>();
        for (const r of this.rows) {
            const arr = groups.get(r.name) ?? [];
            arr.push(r.value);
            groups.set(r.name, arr);
        }
        return Array.from(groups.entries()).map(([name, values]) => {
            const sorted = [...values].sort((a, b) => a - b);
            const pct = (p: number): number | null => {
                if (sorted.length === 0) return null;
                const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
                return sorted[idx];
            };
            return {name, count: values.length, p50: pct(50), p75: pct(75), p95: pct(95)};
        }).sort((a, b) => a.name.localeCompare(b.name));
    }
}
