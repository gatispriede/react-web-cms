import {observable} from '@client/lib/state/observable';
import type {AnalyticsAudience} from '@interfaces/IAnalytics';

/**
 * VM for the Analytics dashboard. v2 (2026-05-06): now wraps the full
 * `SummaryResult` shape from the service (KPIs, daily series, breakdowns).
 *
 * The dashboard defaults to `audience: 'public'` so internal/admin/bot
 * traffic doesn't pollute the customer-facing numbers; everything else
 * is one chip-click away. `audienceMix` is always over the full range
 * regardless of filter, so the chips can show their own share %.
 */

export type AnalyticsRange = '24h' | '7d' | '30d';
export type AudienceFilter = AnalyticsAudience | 'all';

export interface DailyRow { day: string; pageviews: number; uniqueAnon: number; events: number }
export interface PageRow { path: string; count: number }
export interface EventRow { name: string; count: number }
export interface CountryRow { country: string; count: number }
export interface ReferrerRow { referrer: string; count: number }
export interface DeviceRow { device: string; count: number }
export interface BrowserRow { browser: string; count: number }
export interface OsRow { os: string; count: number }
export interface AudienceMixRow { audience: AnalyticsAudience; count: number }

export interface SummaryResult {
    range: AnalyticsRange;
    audience: AudienceFilter;
    since: string;
    totals: {
        pageviews: number;
        events: number;
        uniqueAnon: number;
        uniqueUsers: number;
        sessions: number;
    };
    daily: DailyRow[];
    topPages: PageRow[];
    topEvents: EventRow[];
    topCountries: CountryRow[];
    topReferrers: ReferrerRow[];
    devices: DeviceRow[];
    browsers: BrowserRow[];
    osFamilies: OsRow[];
    audienceMix: AudienceMixRow[];
    error?: string;
}

async function fetchSummary(range: AnalyticsRange, audience: AudienceFilter): Promise<SummaryResult | null> {
    try {
        const r = await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                query: `query Summary($range: String, $audience: String) {
                    mongo { analyticsSummary(range: $range, audience: $audience) }
                }`,
                variables: {range, audience},
            }),
        });
        const json = await r.json();
        const raw = json?.data?.mongo?.analyticsSummary;
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export class AnalyticsPanelViewModel {
    range:    AnalyticsRange = '7d';
    audience: AudienceFilter = 'public';
    summary:  SummaryResult | null = null;
    loading  = false;
    loadedAt: Date | null = null;

    constructor() { return observable(this); }

    setRange(r: AnalyticsRange): void {
        this.range = r;
    }

    setAudience(a: AudienceFilter): void {
        this.audience = a;
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.summary = await fetchSummary(this.range, this.audience);
            this.loadedAt = new Date();
        } finally {
            this.loading = false;
        }
    }
}
