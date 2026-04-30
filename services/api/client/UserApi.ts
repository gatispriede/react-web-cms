import {resolve} from "@services/api/generated";
import {AdminLocale, IUser, InUser} from "@interfaces/IUser";

function normalizeAdminLocale(value: unknown): AdminLocale | undefined {
    return value === 'en' || value === 'lv' ? value : undefined;
}

/** Resolve the GraphQL endpoint for an SSR raw fetch. Mirrors the logic in
 *  `services/api/generated/index.ts` so server-side direct calls land on the
 *  same server. Browser code uses the relative `/api/graphql`. */
function ssrGraphqlUrl(): string {
    if (typeof window !== 'undefined') return '/api/graphql';
    if (process.env.INTERNAL_GRAPHQL_URL) return process.env.INTERNAL_GRAPHQL_URL;
    const port = process.env.BUILD_PORT || 80;
    const isDocker = port !== 80 && port !== '80';
    return isDocker ? `http://server:${port}/` : `http://localhost:${port}/api/graphql`;
}

export class UserApi {
    /**
     * Bypass gqty for the auth-side fetch. The generated `IUser` schema
     * doesn't include `kind` (last codegen pre-dates the customer split),
     * and adding it here without re-running `npm run generate-schema`
     * doesn't get picked up by the proxy. NextAuth's customer authorize()
     * needs `kind` to reject admin docs on the customer form, so the path
     * goes raw POST → /api/graphql with an explicit field set. Re-route
     * back through gqty once a fresh codegen lands.
     */
    async getUser({email}: { email: string }): Promise<IUser | null> {
        try {
            const res = await fetch(ssrGraphqlUrl(), {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    query: `query GetUser($email: String) {
                        mongo {
                            getUser(email: $email) {
                                id name email password role avatar kind
                                canPublishProduction mustChangePassword preferredAdminLocale
                            }
                        }
                    }`,
                    variables: {email},
                }),
            });
            const json = await res.json();
            const user = json?.data?.mongo?.getUser;
            if (!user) return null;
            return {
                id: user.id ?? '',
                name: user.name ?? '',
                email: user.email ?? '',
                password: user.password ?? '',
                role: (user.role ?? 'viewer') as IUser['role'],
                avatar: user.avatar ?? undefined,
                kind: (user.kind ?? 'admin') as IUser['kind'],
                canPublishProduction: Boolean(user.canPublishProduction),
                mustChangePassword: Boolean(user.mustChangePassword),
                preferredAdminLocale: normalizeAdminLocale(user.preferredAdminLocale),
            };
        } catch (err) {
            console.error('UserApi.getUser raw fetch failed:', err);
            return null;
        }
    }

    async listUsers(): Promise<IUser[]> {
        try {
            return await resolve(({query}) => {
                const users: any[] = query.mongo.getUsers;
                return users.map(u => ({
                    id: u.id,
                    name: u.name ?? '',
                    email: u.email,
                    password: '',
                    role: (u.role ?? 'viewer') as IUser['role'],
                    avatar: u.avatar ?? undefined,
                    canPublishProduction: Boolean(u.canPublishProduction),
                    mustChangePassword: Boolean(u.mustChangePassword),
                    preferredAdminLocale: normalizeAdminLocale(u.preferredAdminLocale),
                }));
            });
        } catch (err) {
            console.error('Error listing users:', err);
            return [];
        }
    }

    async addUser(user: InUser): Promise<{id?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => mutation.mongo.addUser({user: user as any}));
            return JSON.parse(raw || '{}').createUser ?? JSON.parse(raw || '{}');
        } catch (err) {
            return {error: String(err)};
        }
    }

    async updateUser(user: InUser): Promise<{id?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => mutation.mongo.updateUser({user: user as any}));
            return JSON.parse(raw || '{}').updateUser ?? JSON.parse(raw || '{}');
        } catch (err) {
            return {error: String(err)};
        }
    }

    async removeUser(id: string): Promise<{id?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => mutation.mongo.removeUser({id}));
            return JSON.parse(raw || '{}').removeUser ?? JSON.parse(raw || '{}');
        } catch (err) {
            return {error: String(err)};
        }
    }
}

export default UserApi;
