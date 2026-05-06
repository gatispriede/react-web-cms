import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {AnalyticsService} from './AnalyticsService';
import {isFeatureEnabled} from '@services/infra/featureFlags';

/**
 * Analytics Loader — first-party event tracking.
 * Per `docs/features/platform/client-analytics.md` (decision 2026-05-02).
 *
 * Defaults to enabled — most operators want analytics out of the box.
 * Plug-and-play toggle via the `analytics` flag flips it off; ingest
 * mutation 404s when disabled (route gate via withFeatureGate or the
 * `analytics` resolver early-returns), so the bytes don't accrue.
 */
export class AnalyticsServiceLoader extends ServiceLoader {
    readonly id = 'analytics';
    readonly displayName = 'Analytics';

    /** Default ON — readable through the standard env > Mongo > default stack. */
    readonly enabled = (): boolean => isFeatureEnabled(this.id);

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {analytics: new AnalyticsService(ctx.db)};
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        // TTL — drops events past `ANALYTICS_RETENTION_DAYS` (default 90).
        {collection: 'Analytics', spec: {ts: 1}, options: {expireAfterSeconds: () => AnalyticsService.retentionSeconds()}},
        // Idempotent dedupe on client-supplied event id.
        {collection: 'Analytics', spec: {id: 1}, options: {unique: true}},
        // Dashboard query patterns. The audience-leading composite index
        // covers the dashboard's default (`audience: 'public'`) range
        // queries; `ts: -1` is the secondary key for time-window scans.
        {collection: 'Analytics', spec: {audience: 1, ts: -1}},
        {collection: 'Analytics', spec: {audience: 1, type: 1, ts: -1}},
        {collection: 'Analytics', spec: {audience: 1, path: 1, ts: -1}},
        {collection: 'Analytics', spec: {anonId: 1, ts: -1}},
        {collection: 'Analytics', spec: {userId: 1, ts: -1}, options: {sparse: true}},
        // Filter doc lives in its own collection — no TTL, single-doc.
    ];

    readonly schemaSDL = `extend type MutationMongo {
    """Public — accept a batch of client-side analytics events. Server validates + rate-limits per anonId; rejected rows silently dropped."""
    trackEvent(events: [JSON!]!): String!
    """Admin — replace the internal-IP allowlist + labels. \`input\` is a JSON object {internalIps: string[], labels?: {ip: label}}."""
    analyticsFiltersUpdate(input: JSON!): String!
}
extend type QueryMongo {
    """Admin — analytics summary for the dashboard. \`range\`: 24h | 7d | 30d. \`audience\`: public (default) | admin | internal | bot | all."""
    analyticsSummary(range: String, audience: String): String!
    """Admin — current internal-IP allowlist + labels."""
    analyticsFiltersGet: String!
}`;

    readonly authz: FeatureAuthzContribution = {
        queryRequirements: {
            analyticsSummary: 'admin',
            analyticsFiltersGet: 'admin',
        },
        mutationRequirements: {
            analyticsFiltersUpdate: 'admin',
        },
        // `analyticsFiltersUpdate` is session-injected so the service
        // can stamp `updatedBy` on the filter doc.
        sessionInjected: ['analyticsFiltersUpdate'],
        // `trackEvent` is intentionally NOT in mutationRequirements — it's
        // public ingest. Keep it out of `customerMutations` too: anonymous
        // callers must be allowed.
        anonOpenMutations: ['trackEvent'],
    };
}
