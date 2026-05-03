import {message} from 'antd';
import UserApi from '@services/api/client/UserApi';
import LanguageApi from '@services/api/client/LanguageApi';
import {IUser, InUser} from '@interfaces/IUser';
import {observable} from '@client/lib/state/observable';
import {Grant} from '@interfaces/IPermission';

/** VM3 — Users admin pane state. */
export class UsersViewModel {
    users: IUser[] = [];
    loading = false;
    saving = false;
    editing: Partial<InUser> | null = null;

    /**
     * Q10 grant-option catalogues — populated once on first refresh.
     * Drive the three constrained `Select mode="multiple"` controls
     * in the edit modal so admins pick from real values instead of
     * typing strings that don't match any registered feature/page/locale.
     * Per coding-principle (2026-05-03): predefined selections beat
     * free-text inputs.
     */
    featureOptions: string[] = [];
    pageOptions: string[] = [];
    localeOptions: string[] = [];

    constructor(
        private readonly api: UserApi = new UserApi(),
        private readonly t: (k: string) => string = (k) => k,
        private readonly languageApi: LanguageApi = new LanguageApi(),
    ) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.users = await this.api.listUsers();
            await this.refreshGrantOptions();
        } catch (err) {
            message.error(String(err));
        } finally {
            this.loading = false;
        }
    }

    /** Pull the three option catalogues used by the grants Selects. Failures
     *  are swallowed per-source — partial catalogues are better than crashing
     *  the whole pane on a missing endpoint. */
    private async refreshGrantOptions(): Promise<void> {
        try {
            const flags = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: `{ mongo { getFeatureFlags } }`}),
            }).then(r => r.json());
            const list: Array<{id: string}> = JSON.parse(flags?.data?.mongo?.getFeatureFlags ?? '[]');
            this.featureOptions = list.map(f => f.id).sort();
        } catch { /* keep last-known list */ }
        try {
            const navResp = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: `{ mongo { getNavigationCollection { page } } }`}),
            }).then(r => r.json());
            const navList: Array<{page: string}> = navResp?.data?.mongo?.getNavigationCollection ?? [];
            this.pageOptions = navList.map(p => p.page).sort();
        } catch { /* keep last-known list */ }
        try {
            const langs = await this.languageApi.getLanguages();
            this.localeOptions = Object.keys(langs).sort();
        } catch { /* keep last-known list */ }
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
