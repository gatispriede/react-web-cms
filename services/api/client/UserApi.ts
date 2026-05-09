import {resolve} from "@services/api/generated";
import {AdminLocale, IUser, InUser} from "@interfaces/IUser";
import {log} from "@services/infra/logger";

function normalizeAdminLocale(value: unknown): AdminLocale | undefined {
    return value === 'en' || value === 'lv' ? value : undefined;
}

export class UserApi {
    async getUser({email}: { email: string }): Promise<IUser | null> {
        return await resolve(({query}) => {
            const user = query.mongo.getUser({email});
            if (!user) return null;
            return {
                id: user.id ?? '',
                name: user.name ?? '',
                email: user.email ?? '',
                password: user.password ?? '',
                role: (user.role ?? 'viewer') as IUser['role'],
                avatar: user.avatar ?? undefined,
                kind: ((user as any).kind ?? 'admin') as IUser['kind'],
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
            log.error({scope: 'users.list', err}, 'listUsers failed');
            return [];
        }
    }

    /** Strip non-schema fields (grants) before sending — `InUser` in
     *  `services/api/schema.graphql` doesn't accept `grants`; that's set
     *  via separate Permissions API calls. The TypeScript `InUser` shape
     *  carries the field for read-side convenience but a write-side
     *  payload must drop it or the GraphQL endpoint rejects with 400
     *  "Variable $... got invalid value". */
    private toMutationPayload(user: InUser): Record<string, unknown> {
        const {grants: _grants, ...rest} = user as InUser & {grants?: unknown};
        return rest;
    }

    async addUser(user: InUser): Promise<{id?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => mutation.mongo.addUser({user: this.toMutationPayload(user) as any}));
            return JSON.parse(raw || '{}').createUser ?? JSON.parse(raw || '{}');
        } catch (err) {
            return {error: String(err)};
        }
    }

    async updateUser(user: InUser): Promise<{id?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => mutation.mongo.updateUser({user: this.toMutationPayload(user) as any}));
            return JSON.parse(raw || '{}').updateUser ?? JSON.parse(raw || '{}');
        } catch (err) {
            return {error: String(err)};
        }
    }

    async removeUser(id: string, opts: {idempotencyKey?: string} = {}): Promise<{id?: string; error?: string}> {
        // Direct POST (not gqty.resolve) — operator reported 2026-05-09 that
        // clicking Remove on the Users pane hangs the UI: button stays in
        // loading state forever, no network response, looks dead. Same
        // gqty-stalls-on-mutation bug we hit with `listThemes()` (see
        // ThemeApi.ts header comment). Raw POST to /api/graphql always
        // resolves cleanly. Same pattern is fine here because the response
        // shape is just `{removeUser: {id, deleted}}` JSON-stringified.
        try {
            const idempotencyKey = opts.idempotencyKey;
            const r = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    query: `mutation R($id: String!, $idempotencyKey: String) { mongo { removeUser(id: $id, idempotencyKey: $idempotencyKey) } }`,
                    variables: {id, idempotencyKey},
                }),
            });
            const json = await r.json();
            const raw = json?.data?.mongo?.removeUser;
            if (json?.errors?.length) {
                return {error: json.errors.map((e: any) => e.message).join('; ')};
            }
            const parsed = JSON.parse(raw || '{}');
            return parsed.removeUser ?? parsed;
        } catch (err) {
            log.error({scope: 'users.remove', err, id}, 'removeUser failed');
            return {error: String(err)};
        }
    }
}

export default UserApi;
