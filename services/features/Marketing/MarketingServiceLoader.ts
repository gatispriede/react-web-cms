import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {MarketingAttributionService} from './MarketingAttributionService';
import {isFeatureEnabled} from '@services/infra/featureFlags';
import {log} from '@services/infra/logger';

function svc(): MarketingAttributionService {
    const conn = getMongoConnection() as any;
    const s = conn.featureServices?.marketing as MarketingAttributionService | undefined;
    if (!s) throw new Error('MarketingAttributionService not available');
    return s;
}

/**
 * W6c — marketing attribution loader.
 *
 * Mints a `marketing` service that handles UTM capture, session→user
 * binding, and reporting for the admin attribution pane. Plug-and-play
 * gateable so an operator running on local POC mode can keep the
 * collection empty.
 */
export class MarketingServiceLoader extends ServiceLoader {
    readonly id = 'marketing';
    readonly displayName = 'Marketing attribution';

    readonly enabled = (): boolean => isFeatureEnabled(this.id);

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {
            marketing: new MarketingAttributionService(
                ctx.db.collection('MarketingReferrer'),
                ctx.db.collection('Users'),
            ),
        };
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        {collection: 'MarketingReferrer', spec: {sessionId: 1, capturedAt: -1}},
        {collection: 'MarketingReferrer', spec: {userId: 1}, options: {sparse: true}},
        {collection: 'MarketingReferrer', spec: {capturedAt: -1}},
        {collection: 'MarketingReferrer', spec: {'utm.campaign': 1}, options: {sparse: true}},
        {collection: 'MarketingReferrer', spec: {'utm.source': 1}, options: {sparse: true}},
    ];

    readonly schemaSDL = `extend type MutationMongo {
    """Public — record one attribution hit. Body: sessionId, utm{}, ref, landingPath, referrer. Idempotent on identical hits."""
    recordMarketingHit(input: JSON!): String!
    """Public — bind an anonymous sessionId to the signed-in user id. Called on signup + magic-link redeem."""
    attachMarketingSession(input: JSON!): String!
}
extend type QueryMongo {
    """Admin — aggregated attribution report. Args: groupBy (source|campaign|ref), range (7d|30d|all)."""
    marketingAttributionReport(groupBy: String, range: String): String!
}`;

    readonly resolvers = {
        QueryMongo: {
            marketingAttributionReport: async (_p: unknown, args: {groupBy?: string; range?: string}) => {
                try {
                    const groupBy = (args.groupBy === 'campaign' || args.groupBy === 'ref') ? args.groupBy : 'source';
                    const report = await svc().report({groupBy: groupBy as any, range: args.range ?? '30d'});
                    return JSON.stringify(report);
                } catch (err) {
                    log.error({scope: 'marketing.report.resolver', err}, 'query failed');
                    return JSON.stringify({error: String((err as Error).message ?? err)});
                }
            },
        },
        MutationMongo: {
            recordMarketingHit: async (_p: unknown, args: {input: unknown}) => {
                try {
                    const result = await svc().recordHit(args.input as any);
                    return JSON.stringify(result);
                } catch (err) {
                    return JSON.stringify({error: String((err as Error).message ?? err)});
                }
            },
            attachMarketingSession: async (_p: unknown, args: {input: unknown}) => {
                try {
                    const input = args.input as {sessionId: string; userId: string};
                    const result = await svc().attachToUser(input);
                    return JSON.stringify(result);
                } catch (err) {
                    return JSON.stringify({error: String((err as Error).message ?? err)});
                }
            },
        },
    };

    readonly authz: FeatureAuthzContribution = {
        queryRequirements: {
            marketingAttributionReport: 'admin',
        },
        anonOpenMutations: ['recordMarketingHit', 'attachMarketingSession'],
    };
}
