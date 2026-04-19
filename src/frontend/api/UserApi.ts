import {resolve} from "../gqty";
import {AdminLocale, IUser, InUser} from "../../Interfaces/IUser";

function normalizeAdminLocale(value: unknown): AdminLocale | undefined {
    return value === 'en' || value === 'lv' ? value : undefined;
}

export class UserApi {
    async getUser({email}: { email: string }): Promise<IUser | null> {
        return await resolve(({query}) => {
            const user = query.mongo.getUser({email});
            if (!user) return null;
            return {
                id: user.id,
                name: user.name ?? '',
                email: user.email,
                password: user.password,
                role: (user.role ?? 'viewer') as IUser['role'],
                avatar: user.avatar ?? undefined,
                canPublishProduction: Boolean((user as any).canPublishProduction),
                mustChangePassword: Boolean((user as any).mustChangePassword),
                preferredAdminLocale: normalizeAdminLocale((user as any).preferredAdminLocale),
            };
        });
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
