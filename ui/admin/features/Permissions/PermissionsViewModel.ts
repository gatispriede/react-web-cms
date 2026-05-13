import {observable} from '@client/lib/state/observable';
import {notifyError, notifyPromise} from '@admin/lib/notify';
import {IUser} from '@interfaces/IUser';
import UserApi from '@services/api/client/UserApi';
import PermissionsApi, {GrantRow} from './PermissionsApi';
import {ROLE_PRESETS, RolePresetId, findPreset} from './rolePresets';
import {
    ScopeKey,
    SCOPE_ORDER,
    Tier,
    inferTierFromGrants,
    tierToGrants,
} from './tierMapping';

/**
 * VM3 — Permissions admin pane state. Owns the user-list + editor
 * state, with the tier grid as the primary surface and per-resource
 * overrides as a disclosure. Single source of truth for the
 * Simplified/Advanced views (per AUI mode hierarchy 2026-05-07).
 */
export class PermissionsViewModel {
    users: IUser[] = [];
    grants: GrantRow[] = [];
    loading = false;
    saving = false;

    /** Per-resource override draft state (Advanced mode panel). Kept on
     *  the VM so the override panel obeys the no-useState lint rule. */
    overrideDraft: {scope: string; resourceId: string} = {scope: 'page', resourceId: ''};

    setOverrideDraftScope(scope: string): void {
        this.overrideDraft = {...this.overrideDraft, scope};
    }
    setOverrideDraftResource(resourceId: string): void {
        this.overrideDraft = {...this.overrideDraft, resourceId};
    }
    resetOverrideDraft(): void {
        this.overrideDraft = {scope: 'page', resourceId: ''};
    }

    /** Currently-open editor target. `null` when the modal is closed. */
    editing: {
        userId: string;
        userEmail: string;
        userName: string;
        preset: RolePresetId;
        /** Tier per scope key — drives the radio grid. */
        tiers: Record<ScopeKey, Tier>;
        /** `canPublishProduction` mirror; toggled by the Full tier. */
        canPublishProduction: boolean;
    } | null = null;

    constructor(
        private readonly api: PermissionsApi = new PermissionsApi(),
        private readonly userApi: UserApi = new UserApi(),
        private readonly t: (k: string) => string = (k) => k,
    ) {
        return observable(this);
    }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            const [users, grants] = await Promise.all([
                this.userApi.listUsers(),
                this.api.listGrants(),
            ]);
            this.users = users.filter(u => (u.kind ?? 'admin') === 'admin');
            this.grants = grants;
        } catch (err) {
            notifyError(err);
        } finally {
            this.loading = false;
        }
    }

    /** Open the tier-grid editor on a specific user. Infers tiers from
     *  the user's existing engine grant rows so the grid loads pre-set. */
    openEdit(user: IUser): void {
        const userGrants = this.grants.filter(g => g.userId === user.id);
        const tiers = SCOPE_ORDER.reduce((acc, scope) => {
            acc[scope] = inferTierFromGrants(scope, userGrants, Boolean(user.canPublishProduction));
            return acc;
        }, {} as Record<ScopeKey, Tier>);
        this.editing = {
            userId: user.id,
            userEmail: user.email,
            userName: user.name ?? '',
            preset: 'custom',
            tiers,
            canPublishProduction: Boolean(user.canPublishProduction),
        };
    }

    close(): void { this.editing = null; }

    /** Apply a role preset — overwrites the tier grid. Operator can
     *  still adjust any cell after. */
    applyPreset(id: RolePresetId): void {
        if (!this.editing) return;
        const preset = findPreset(id);
        if (!preset) return;
        if (id === 'custom') {
            this.editing = {...this.editing, preset: id};
            return;
        }
        const tiers = {...this.editing.tiers};
        for (const scope of SCOPE_ORDER) {
            const t = preset.tiers[scope];
            if (t) tiers[scope] = t;
        }
        // Full anywhere → publish on. Otherwise leave existing toggle.
        const hasFull = SCOPE_ORDER.some(s => tiers[s] === 'Full');
        this.editing = {
            ...this.editing,
            preset: id,
            tiers,
            canPublishProduction: hasFull || this.editing.canPublishProduction,
        };
    }

    setTier(scope: ScopeKey, tier: Tier): void {
        if (!this.editing) return;
        const tiers = {...this.editing.tiers, [scope]: tier};
        this.editing = {
            ...this.editing,
            preset: 'custom',
            tiers,
            canPublishProduction:
                tier === 'Full' ? true : this.editing.canPublishProduction,
        };
    }

    /**
     * Persist the tier grid by diffing intended grants against the
     * engine rows the user currently holds. Issues grant/revoke calls
     * for only the cells that changed — same approach as the existing
     * permission MCP tools.
     */
    async save(): Promise<void> {
        if (!this.editing) return;
        this.saving = true;
        const {userId, tiers, canPublishProduction} = this.editing;

        // Compute desired engine rows from the tier grid.
        const desired = new Set<string>();
        for (const scope of SCOPE_ORDER) {
            for (const spec of tierToGrants(scope, tiers[scope])) {
                desired.add(`${spec.scope}:${spec.resourceId}`);
            }
        }
        const existing = new Set<string>();
        for (const row of this.grants.filter(g => g.userId === userId)) {
            existing.add(`${row.scope}:${row.resourceId}`);
        }
        const toGrant: Array<{scope: string; resourceId: string}> = [];
        const toRevoke: Array<{scope: string; resourceId: string}> = [];
        for (const key of desired) {
            if (!existing.has(key)) {
                const [scope, resourceId] = key.split(':');
                toGrant.push({scope: scope!, resourceId: resourceId!});
            }
        }
        for (const key of existing) {
            if (!desired.has(key)) {
                const [scope, resourceId] = key.split(':');
                toRevoke.push({scope: scope!, resourceId: resourceId!});
            }
        }

        try {
            await notifyPromise(
                (async () => {
                    for (const g of toGrant) {
                        const r = await this.api.grant({userId, ...g});
                        if (r.error) throw new Error(r.error);
                    }
                    for (const g of toRevoke) {
                        const r = await this.api.revoke({userId, ...g});
                        if (r.error) throw new Error(r.error);
                    }
                    // Update canPublishProduction via the existing
                    // updateUser path. Best-effort; failure is non-fatal
                    // and is reported via the toast.
                    const currentUser = this.users.find(u => u.id === userId);
                    if (currentUser && currentUser.canPublishProduction !== canPublishProduction) {
                        await this.userApi.updateUser({
                            id: userId,
                            email: currentUser.email,
                            canPublishProduction,
                            role: currentUser.role,
                        });
                    }
                })(),
                {
                    loading: this.t('permissions.saving'),
                    success: this.t('permissions.saved'),
                    error: (err) => `${this.t('permissions.saveFailed')}: ${String((err as Error)?.message ?? err)}`,
                },
            );
            this.close();
            await this.refresh();
        } catch {
            // notifyPromise surfaces the toast; no extra log needed.
        } finally {
            this.saving = false;
        }
    }

    /** Per-resource override — grant a single (scope, resourceId) row
     *  on top of the tier baseline. Used by the Advanced view. */
    async grantOverride(userId: string, scope: string, resourceId: string): Promise<void> {
        const r = await this.api.grant({userId, scope, resourceId});
        if (r.error) { notifyError(r.error); return; }
        await this.refresh();
    }

    async revokeOverride(userId: string, scope: string, resourceId: string): Promise<void> {
        const r = await this.api.revoke({userId, scope, resourceId});
        if (r.error) { notifyError(r.error); return; }
        await this.refresh();
    }

    /** Count of engine grant rows held by a user. Drives the list-view
     *  summary column. */
    grantCountFor(userId: string): number {
        return this.grants.filter(g => g.userId === userId).length;
    }

    /** Role presets exposed to the editor. */
    get presets() { return ROLE_PRESETS; }
}
