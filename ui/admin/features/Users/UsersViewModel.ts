import {message} from 'antd';
import UserApi from '@services/api/client/UserApi';
import {IUser, InUser} from '@interfaces/IUser';
import {observable} from '@client/lib/state/observable';
import {Grant} from '@interfaces/IPermission';

/** VM3 — Users admin pane state. */
export class UsersViewModel {
    users: IUser[] = [];
    loading = false;
    saving = false;
    editing: Partial<InUser> | null = null;

    constructor(
        private readonly api: UserApi = new UserApi(),
        private readonly t: (k: string) => string = (k) => k,
    ) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.users = await this.api.listUsers();
        } catch (err) {
            message.error(String(err));
        } finally {
            this.loading = false;
        }
    }

    openCreate(): void {
        this.editing = {role: 'viewer', canPublishProduction: false};
    }

    openEdit(user: IUser): void {
        this.editing = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            canPublishProduction: user.canPublishProduction,
            grants: user.grants ?? [],
        };
    }

    /**
     * Q10 — replace the editing user's grants with the three multiselect
     * arrays from the admin UI. Stored as a flat `Grant[]` (discriminated
     * union) so the server can read it without re-deriving the shape.
     */
    setGrants(features: string[], pages: string[], locales: string[]): void {
        if (!this.editing) return;
        const grants: Grant[] = [
            ...features.map(f => ({kind: 'feature' as const, feature: f})),
            ...pages.map(p => ({kind: 'page' as const, page: p})),
            ...locales.map(l => ({kind: 'locale' as const, locale: l})),
        ];
        this.editing = {...this.editing, grants};
    }

    close(): void { this.editing = null; }

    /**
     * Save the form payload. Caller passes `currentEmail` and an
     * `onOwnPasswordRotated` hook so the Users pane can refresh the
     * NextAuth session when the current user changes their own password.
     */
    async save(values: InUser, currentEmail: string, onOwnPasswordRotated: () => Promise<void>): Promise<void> {
        this.saving = true;
        try {
            const payload: InUser = {
                id: this.editing?.id,
                email: values.email,
                name: values.name,
                role: values.role,
                password: values.password || undefined,
                canPublishProduction: Boolean(values.canPublishProduction),
                grants: this.editing?.grants ?? values.grants ?? [],
            };
            const result = this.editing?.id
                ? await this.api.updateUser(payload)
                : await this.api.addUser(payload);
            if (result.error) { message.error(result.error); return; }
            if (this.editing?.id && values.password && this.editing.email === currentEmail) {
                await onOwnPasswordRotated();
            }
            message.success(this.editing?.id ? this.t('User updated') : this.t('User created'));
            this.close();
            await this.refresh();
        } finally {
            this.saving = false;
        }
    }

    async remove(user: IUser): Promise<void> {
        const result = await this.api.removeUser(user.id);
        if (result.error) { message.error(result.error); return; }
        message.success(this.t('User removed'));
        await this.refresh();
    }
}
