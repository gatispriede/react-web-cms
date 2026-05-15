import {McpTool} from '../types';
import {defineTool} from './_shared';
import {enforceModeForTool} from '../modeEnforcement';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {AUTH_FLAG_PATHS} from '@services/features/Auth/authFlags';
import {AdminAuthService} from '@services/features/Auth/AdminAuthService';

/**
 * Auth MCP tools — auth-split-client-admin (Phase 1.A).
 *
 * Exposes:
 *  - `auth.config.get` — read the `auth.*` site-flag namespace plus
 *    per-provider env-readiness so the agent can recommend "you need
 *    `AUTH_CUSTOMER_GOOGLE_ID` before enabling providerGoogle".
 *  - `auth.config.set` — flip a single `auth.*` flag. Audit-logged
 *    through the standard dispatcher path.
 *  - `auth.providers.list` — enumerate enabled providers for both
 *    stacks (admin + customer).
 *  - `auth.session.invalidate` — bump the per-user `sessionEpoch`
 *    counter on the `Users` doc so an admin's active JWT becomes
 *    immediately invalid. Covers both admin and customer kinds.
 */

interface AuthFlagsView {
    clientLoginEnabled: boolean;
    providerMagicLink: boolean;
    providerCredentials: boolean;
    providerGoogle: boolean;
    providerFacebook: boolean;
    providerApple: boolean;
}

function viewFromFlags(raw: Record<string, unknown> | undefined): AuthFlagsView {
    const a = raw ?? {};
    return {
        clientLoginEnabled: Boolean(a.clientLoginEnabled),
        providerMagicLink: Boolean(a.providerMagicLink ?? true),
        providerCredentials: Boolean(a.providerCredentials),
        providerGoogle: Boolean(a.providerGoogle),
        providerFacebook: Boolean(a.providerFacebook),
        providerApple: Boolean(a.providerApple),
    };
}

function envReadiness(): Record<string, boolean> {
    return {
        adminGoogle: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
        customerGoogle: Boolean(process.env.AUTH_CUSTOMER_GOOGLE_ID && process.env.AUTH_CUSTOMER_GOOGLE_SECRET),
        customerFacebook: Boolean(process.env.FACEBOOK_OAUTH_ENABLED === 'true' && process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET),
        customerApple: Boolean(process.env.APPLE_OAUTH_ENABLED === 'true' && process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET),
    };
}

export const authConfigGet: McpTool = defineTool({
    name: 'auth.config.get',
    description: 'Read the auth.* site-flag namespace (clientLoginEnabled + per-provider sub-toggles) plus per-provider env-readiness for OAuth credentials.',
    scopes: ['read:site'],
    inputSchema: {type: 'object', properties: {}},
}, async (_args, _ctx) => {
    const flags = await getMongoConnection().siteFlagsService.get();
    return {
        flags: viewFromFlags(flags.auth as Record<string, unknown> | undefined),
        envReadiness: envReadiness(),
        flagPaths: AUTH_FLAG_PATHS,
    };
});

export const authConfigSet: McpTool = defineTool({
    name: 'auth.config.set',
    description: 'Flip one auth.* site-flag (path like "auth.clientLoginEnabled" or "auth.providerGoogle"). Audit-logged.',
    scopes: ['write:site'],
    idempotent: true,
    auditScope: 'auth',
    inputSchema: {
        type: 'object',
        required: ['path', 'value'],
        properties: {
            path: {
                type: 'string',
                enum: AUTH_FLAG_PATHS as readonly string[] as string[],
                description: 'Dotted path under the auth namespace. Must be a registered auth.* flag.',
            },
            value: {type: 'boolean'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'auth.config.set');
    const path = String(args.path);
    if (!AUTH_FLAG_PATHS.includes(path as typeof AUTH_FLAG_PATHS[number])) {
        return {ok: false, error: `Unknown auth flag path: ${path}`};
    }
    const key = path.slice('auth.'.length);
    const value = Boolean(args.value);
    try {
        const next = await getMongoConnection().siteFlagsService.save(
            {auth: {[key]: value}} as never,
            ctx.actor,
        );
        return {ok: true, path, value, flags: viewFromFlags(next.auth as Record<string, unknown> | undefined)};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const authProvidersList: McpTool = defineTool({
    name: 'auth.providers.list',
    description: 'Enumerate enabled providers for both stacks (admin + customer). Cross-references siteFlags.auth.provider* against the env-var readiness for OAuth credentials.',
    scopes: ['read:site'],
    inputSchema: {type: 'object', properties: {}},
}, async (_args, _ctx) => {
    const flags = viewFromFlags(((await getMongoConnection().siteFlagsService.get()).auth) as Record<string, unknown> | undefined);
    const env = envReadiness();
    return {
        admin: {
            providers: [
                {id: 'admin-credentials', enabled: true, envReady: true},
                {id: 'admin-google', enabled: env.adminGoogle, envReady: env.adminGoogle},
            ],
        },
        customer: {
            clientLoginEnabled: flags.clientLoginEnabled,
            providers: [
                {id: 'customer-magic', enabled: flags.clientLoginEnabled && flags.providerMagicLink, envReady: true},
                {id: 'customer-credentials', enabled: flags.clientLoginEnabled && flags.providerCredentials, envReady: true},
                {id: 'customer-google', enabled: flags.clientLoginEnabled && flags.providerGoogle, envReady: env.customerGoogle},
                {id: 'customer-facebook', enabled: flags.clientLoginEnabled && flags.providerFacebook, envReady: env.customerFacebook},
                {id: 'customer-apple', enabled: flags.clientLoginEnabled && flags.providerApple, envReady: env.customerApple},
            ],
        },
    };
});

export const authSessionInvalidate: McpTool = defineTool({
    name: 'auth.session.invalidate',
    description: 'Invalidate all sessions for one user (admin or customer) by user id. Bumps the user-level session epoch — the next request after the bump forces a re-sign-in.',
    scopes: ['write:users'],
    idempotent: false,
    auditScope: 'auth',
    inputSchema: {
        type: 'object',
        required: ['userId'],
        properties: {
            userId: {type: 'string', description: 'IUser.id for the target user.'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'auth.session.invalidate');
    const userId = String(args.userId);
    if (!userId) return {ok: false, error: 'userId required'};
    const usersDB = (getMongoConnection() as any).db?.collection?.('Users');
    if (!usersDB) return {ok: false, error: 'Users collection unavailable'};
    const svc = new AdminAuthService(usersDB);
    const result = await svc.invalidateSessions(userId);
    return result;
});

export const AUTH_TOOLS: McpTool[] = [
    authConfigGet,
    authConfigSet,
    authProvidersList,
    authSessionInvalidate,
];
