import {getServerSession} from 'next-auth/next';
import type {NextAuthOptions} from 'next-auth';
import {UserRole} from '@interfaces/IUser';

export const ROLE_RANK: Record<UserRole, number> = {viewer: 0, editor: 1, admin: 2};

export interface GraphqlSession {
    role: UserRole;
    email?: string;
    canPublishProduction?: boolean;
}

// Layering note: `authOptions` lives in the frontend tree (next to the NextAuth
// page route it configures). Callers pass it in so Server code never imports
// across the layer boundary.
export async function sessionFromReq(req: any, res: any, authOptions: NextAuthOptions): Promise<GraphqlSession> {
    try {
        const session = await getServerSession(req, res, authOptions);
        const user = session?.user as any;
        return {
            role: (user?.role ?? 'viewer') as UserRole,
            email: user?.email,
            canPublishProduction: Boolean(user?.canPublishProduction),
        };
    } catch {
        return {role: 'viewer'};
    }
}

export class AuthzError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthzError';
    }
}

export function assertRole(session: GraphqlSession, minimum: UserRole) {
    if (ROLE_RANK[session.role] < ROLE_RANK[minimum]) {
        throw new AuthzError(`Forbidden: ${minimum} role required (current: ${session.role})`);
    }
}

export type Capability = (session: GraphqlSession) => boolean | string;

/**
 * Methods listed here receive the caller's session (email) merged into their
 * first argument as `_session`. Services read `args._session?.email` to stamp
 * audit fields like `publishedBy`/`editedBy`. The underlying service methods
 * keep their original signatures — the Proxy injects the session; standalone
 * server callers (which don't have sessions) just don't pass `_session` and
 * the services fall back to `undefined`.
 */
export const SESSION_INJECTED_METHODS: ReadonlySet<string> = new Set([
    // Publish/rollback — stamps `publishedBy` on the snapshot doc.
    'publishSnapshot',
    'rollbackToSnapshot',
    // Content edits — stamps `editedBy` + `editedAt` on the touched doc.
    'addUpdateSectionItem',
    'updateNavigation',
    'replaceUpdateNavigation',
    'addUpdateNavigationItem',
    'deleteNavigationItem',
    'removeSectionItem',
    // Theme / Post / Site-settings editors.
    'saveTheme',
    'deleteTheme',
    'setActiveTheme',
    'resetPreset',
    'savePost',
    'deletePost',
    'setPostPublished',
    'saveFooter',
    'saveSiteFlags',
    'saveSiteSeo',
    'saveTranslationMeta',
    'saveLogo',
    'addUpdateLanguage',
    'deleteLanguage',
]);

export function guardMethods<T extends object>(
    target: T,
    session: GraphqlSession,
    required: Record<string, UserRole>,
    capabilities: Record<string, Capability> = {},
): T {
    return new Proxy(target, {
        get(obj, prop: string | symbol, receiver) {
            const value = Reflect.get(obj, prop, receiver);
            if (typeof value !== 'function') return value;
            const key = String(prop);
            const minimum = required[key];
            if (minimum && ROLE_RANK[session.role] < ROLE_RANK[minimum]) {
                return () => {
                    throw new AuthzError(`Forbidden: ${minimum} role required for ${key} (current: ${session.role})`);
                };
            }
            const capability = capabilities[key];
            if (capability) {
                const result = capability(session);
                if (result !== true) {
                    return () => {
                        throw new AuthzError(typeof result === 'string' ? result : `Forbidden: capability check failed for ${key}`);
                    };
                }
            }
            if (SESSION_INJECTED_METHODS.has(key)) {
                const bound = value.bind(obj);
                return (args: any = {}) => bound({...args, _session: session});
            }
            return value.bind(obj);
        },
    });
}

export const MUTATION_CAPABILITIES: Record<string, Capability> = {
    publishSnapshot: (s) => s.canPublishProduction ? true : 'canPublishProduction required to publish',
    rollbackToSnapshot: (s) => s.canPublishProduction ? true : 'canPublishProduction required to rollback',
};

export const MUTATION_REQUIREMENTS: Record<string, UserRole> = {
    createNavigation: 'editor',
    addUpdateNavigationItem: 'editor',
    updateNavigation: 'editor',
    replaceUpdateNavigation: 'editor',
    addUpdateSectionItem: 'editor',
    removeSectionItem: 'editor',
    deleteNavigationItem: 'editor',
    saveImage: 'editor',
    deleteImage: 'editor',
    saveLogo: 'editor',
    addUpdateLanguage: 'editor',
    deleteLanguage: 'editor',
    addUser: 'admin',
    updateUser: 'admin',
    removeUser: 'admin',
    publishSnapshot: 'editor',
    rollbackToSnapshot: 'editor',
    saveTheme: 'editor',
    deleteTheme: 'editor',
    setActiveTheme: 'editor',
    resetPreset: 'editor',
    savePost: 'editor',
    deletePost: 'editor',
    setPostPublished: 'editor',
    saveFooter: 'editor',
    saveSiteFlags: 'admin',
    saveSiteSeo: 'editor',
    saveTranslationMeta: 'editor',
};

export const QUERY_REQUIREMENTS: Record<string, UserRole> = {
    getUsers: 'admin',
    setupAdmin: 'admin',
    getMongoDBUri: 'admin',
    loadData: 'admin',
    // Audit log is admin-only — diffs can include user text and actor
    // metadata we don't want exposing to editors.
    getAuditLog: 'admin',
    getAuditCollections: 'admin',
    getAuditActors: 'admin',
};
