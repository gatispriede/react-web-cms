import {observable} from '@client/lib/state/observable';

export interface PageRow { path: string; count: number }
export interface EventRow { name: string; count: number }
/**
 * Country breakdown row. `country` is an ISO 3166-1 alpha-2 code or
 * the literal `"Unknown"` for rows where the server couldn't derive
 * one (IPv6, missing dataset, unmatched range).
 */
export interface CountryRow { country: string; count: number }
export interface SummaryResult {
    range: string;
    since: string;
    topPages: PageRow[];
    topEvents: EventRow[];
    topCountries?: CountryRow[];
    error?: string;
}

export type AnalyticsRange = '24h' | '7d' | '30d';

async function fetchSummary(range: string): Promise<SummaryResult | null> {
    try {
        const r = await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: `query Summary($range: String!) { mongo { analyticsSummary(range: $range) } }`,
                variables: {range},
            }),
        });
        const json = await r.json();
        const raw = json?.data?.mongo?.analyticsSummary;
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

/** VM3 — Analytics admin pane. Holds range filter + fetched summary. */
export class AnalyticsPanelViewModel {
    range:    AnalyticsRange = '7d';
    summary:  SummaryResult | null = null;
    loading  = false;
    loadedAt: Date | null = null;

    constructor() { return observable(this); }

    setRange(r: AnalyticsRange): void {
        this.range = r;
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.summary = await fetchSummary(this.range);
            this.loadedAt = new Date();
        } finally {
            this.loading = false;
        }
    }
}
