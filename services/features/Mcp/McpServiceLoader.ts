import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {McpTokenService} from './McpTokenService';

/**
 * MCP Loader — Class Loader L3 migration of `mcpFeature`.
 *
 * Owns `McpTokenService` (issues/verifies/revokes machine-to-machine
 * tokens). The legacy `mongoConn.mcpTokenService` getter maps to
 * `featureServices.mcp` so call sites keep reading through unchanged.
 */
export class McpServiceLoader extends ServiceLoader {
    readonly id = 'mcp';
    readonly displayName = 'MCP tokens';

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {mcp: new McpTokenService(ctx.db)};
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        {collection: 'McpTokens', spec: {id: 1}, options: {unique: true}},
        {collection: 'McpTokens', spec: {tokenIdPrefix: 1}},
        {collection: 'McpTokens', spec: {revokedAt: 1, expiresAt: 1}},
    ];

    readonly schemaSDL = `extend type QueryMongo {
    """Admin-only — list issued MCP tokens (no secrets returned)."""
    mcpListTokens: String!
}
extend type MutationMongo {
    """Admin-only — issue a new MCP token. Secret is returned ONCE in the response."""
    mcpIssueToken(name: String!, scopes: [String!]!, ttlDays: Int): String!
    """Admin-only — revoke an MCP token by id."""
    mcpRevokeToken(id: String!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        queryRequirements: {
            mcpListTokens: 'admin',
        },
        mutationRequirements: {
            mcpIssueToken: 'admin',
            mcpRevokeToken: 'admin',
        },
        sessionInjected: [
            'mcpIssueToken',
            'mcpRevokeToken',
        ],
    };
}
