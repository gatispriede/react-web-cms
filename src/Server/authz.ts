import {getServerSession} from 'next-auth/next';
import {authOptions} from '../frontend/pages/api/auth/[...nextauth]';
import {UserRole} from '../Interfaces/IUser';

export const ROLE_RANK: Record<UserRole, number> = {viewer: 0, editor: 1, admin: 2};

export interface GraphqlSession {
    role: UserRole;
    email?: string;
    canPublishProduction?: boolean;
}

export async function sessionFromReq(req: any, res: any): Promise<GraphqlSession> {
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
    savePost: 'editor',
    deletePost: 'editor',
    setPostPublished: 'editor',
    saveFooter: 'editor',
    saveSiteFlags: 'admin',
};

export const QUERY_REQUIREMENTS: Record<string, UserRole> = {
    getUsers: 'admin',
    setupAdmin: 'admin',
    getMongoDBUri: 'admin',
    loadData: 'admin',
};
