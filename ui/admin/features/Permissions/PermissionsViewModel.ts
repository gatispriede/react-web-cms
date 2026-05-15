import {observable} from '@client/lib/state/observable';
import {notifyError, notifyPromise, notifySuccess} from '@admin/lib/notify';
import {IUser} from '@interfaces/IUser';
import UserApi from '@services/api/client/UserApi';
import PermissionsApi, {GrantRow, GrantCatalogues} from './PermissionsApi';
import {ROLE_PRESETS, RolePresetId, findPreset} from './rolePresets';
import {
    ScopeKey,
    SCOPE_ORDER,
    Tier,
    GrantDimension,
    GRANT_DIMENSIONS,
    grantScopeFor,
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

    /**
     * Grant-grid catalogues — the constrained option sets for the
     * feature / page / locale grant-grid. Loaded once on refresh from
     * the live registries so the grid only ever offers real values.
     */
    catalogues: GrantCatalogues = {features: [], pages: [], locales: []};

    /**
     * Per-resource overlay target. The grant-grid opens a detail
     * overlay (grantedBy / grantedAt / revoke) when an operator clicks a
     * granted cell. `null` when no overlay is open. Kept on the VM so the
     * overlay obeys the no-useState lint rule.
     */
    overlay: {dimension: GrantDimension; resourceId: string} | null = null;

    /** Per-cell in-flight guard so a double-click doesn't double-fire. */
    pendingCells: Set<string> = new Set();

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
            const [users, catalogues] = await Promise.all([
                this.userApi.listUsers(),
                this.api.listCatalogues(),
            ]);
            this.users = users.filter(u => (u.kind ?? 'admin') === 'admin');
            this.catalogues = catalogues;
            // Grant rows are fanned out per-user — needs the user list first.
            this.grants = await this.api.listGrants(this.users.map(u => u.id));
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
        this.overlay = null;
    }

    close(): void {
        this.editing = null;
        this.overlay = null;
    }

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

    // ──────────────────────────────────────────────────────────────────
    // Grant-grid — feature / page / locale dimension grants.
    //
    // Each cell is a discrete `(dimension, resourceId)` grant persisted
    // as an engine row under the reserved scope name (`grantScopeFor`).
    // Toggling persists immediately — one grant/revoke call per cell —
    // so the grid behaves like the per-resource override panel rather
    // than the diff-on-save tier grid. Lighter on the operator: no "did
    // I forget to save?" ambiguity for a single checkbox flip.
    // ──────────────────────────────────────────────────────────────────

    private cellKey(userId: string, dimension: GrantDimension, resourceId: string): string {
        return `${userId}:${dimension}:${resourceId}`;
    }

    /** Engine rows for a user that belong to the grant-grid (the three
     *  reserved dimension scopes). Powers the grid's checked state. */
    grantGridRowsFor(userId: string): GrantRow[] {
        const dims = GRANT_DIMENSIONS as readonly string[];
        return this.grants.filter(g => g.userId === userId && dims.includes(g.scope));
    }

    /** Whether the editing user holds a grant on `(dimension, resourceId)`. */
    hasGrant(userId: string, dimension: GrantDimension, resourceId: string): boolean {
        const scope = grantScopeFor(dimension);
        return this.grants.some(
            g => g.userId === userId && g.scope === scope && g.resourceId === resourceId,
        );
    }

    /** Whether a cell has an in-flight grant/revoke call. */
    isCellPending(userId: string, dimension: GrantDimension, resourceId: string): boolean {
        return this.pendingCells.has(this.cellKey(userId, dimension, resourceId));
    }

    /**
     * Toggle a single grant-grid cell. Grants or revokes the engine row
     * under the dimension's reserved scope, then patches `this.grants`
     * in place so the grid updates without a full refresh round-trip.
     */
    async toggleGrant(userId: string, dimension: GrantDimension, resourceId: string): Promise<void> {
        const key = this.cellKey(userId, dimension, resourceId);
        if (this.pendingCells.has(key)) return;
        const scope = grantScopeFor(dimension);
        const currentlyGranted = this.hasGrant(userId, dimension, resourceId);
        this.pendingCells = new Set(this.pendingCells).add(key);
        try {
            const r = currentlyGranted
                ? await this.api.revoke({userId, scope, resourceId})
                : await this.api.grant({userId, scope, resourceId});
            if (r.error) { notifyError(r.error); return; }
            if (currentlyGranted) {
                this.grants = this.grants.filter(
                    g => !(g.userId === userId && g.scope === scope && g.resourceId === resourceId),
                );
            } else {
                this.grants = [
                    ...this.grants,
                    {
                        id: `${userId}:${scope}:${resourceId}`,
                        userId,
                        scope,
                        resourceId,
                        grantedAt: new Date().toISOString(),
                    },
                ];
            }
            notifySuccess(
                currentlyGranted
                    ? this.t('permissions.grantGrid.revoked')
                    : this.t('permissions.grantGrid.granted'),
            );
        } finally {
            const next = new Set(this.pendingCells);
            next.delete(key);
            this.pendingCells = next;
        }
    }

    /** Open the per-resource overlay on a granted cell. */
    openOverlay(dimension: GrantDimension, resourceId: string): void {
        this.overlay = {dimension, resourceId};
    }

    closeOverlay(): void { this.overlay = null; }

    /** The engine row backing the currently-open overlay, if any. */
    overlayRow(): GrantRow | undefined {
        if (!this.overlay || !this.editing) return undefined;
        const scope = grantScopeFor(this.overlay.dimension);
        return this.grants.find(
            g => g.userId === this.editing!.userId
                && g.scope === scope
                && g.resourceId === this.overlay!.resourceId,
        );
    }

    /** Revoke the grant behind the open overlay, then close it. */
    async revokeFromOverlay(): Promise<void> {
        if (!this.overlay || !this.editing) return;
        const {dimension, resourceId} = this.overlay;
        await this.toggleGrant(this.editing.userId, dimension, resourceId);
        this.closeOverlay();
    }

    /** Catalogue option list for a grant dimension. */
    cataloguesFor(dimension: GrantDimension): string[] {
        if (dimension === 'feature') return this.catalogues.features;
        if (dimension === 'page') return this.catalogues.pages;
        return this.catalogues.locales;
    }

    /** Count of engine grant rows held by a user. Drives the list-view
     *  summary column. */
    grantCountFor(userId: string): number {
        return this.grants.filter(g => g.userId === userId).length;
    }

    /** Role presets exposed to the editor. */
    get presets() { return ROLE_PRESETS; }
}
