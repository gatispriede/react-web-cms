/**
 * Releases admin pane state.
 *
 * Backed by the `/api/releases` REST surface (see `ReleasesApi.ts`).
 * Long-running + destructive flows (`publish`, `rollback`) wrap their
 * promises in `notifyPromise` so Sonner renders loading + success +
 * failure toasts in one go.
 */
import {observable} from '@client/lib/state/observable';
import {notifyError, notifyPromise} from '@admin/lib/notify';
import {RELEASE_ENTITY_KINDS, type IRelease, type IReleaseSummary, type ReleaseEntityKind} from '@interfaces/IRelease';
import {releasesApi} from './ReleasesApi';

export const RELEASE_ENTITY_OPTIONS = RELEASE_ENTITY_KINDS.map(k => ({label: k, value: k}));

export class ReleasesViewModel {
    list: IReleaseSummary[] = [];
    selected: IRelease | null = null;
    loading = false;
    saving = false;
    // attach form
    attachEntity: ReleaseEntityKind = 'page';
    attachId = '';
    // create form
    createTitle = '';
    createDescription = '';

    constructor() {
        return observable(this);
    }

    // Setters — the observable proxy forbids direct field reassignment
    // from JSX onChange handlers (the react-hooks immutability rule
    // catches the inline `vm.x = ...` pattern). Methods route through
    // the proxy intercept cleanly.
    setCreateTitle(v: string): void { this.createTitle = v; }
    setCreateDescription(v: string): void { this.createDescription = v; }
    setAttachEntity(v: ReleaseEntityKind): void { this.attachEntity = v; }
    setAttachId(v: string): void { this.attachId = v; }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.list = await releasesApi.list();
            if (this.selected) {
                this.selected = await releasesApi.get(this.selected.id);
            }
        } catch (err) {
            notifyError(err);
        } finally {
            this.loading = false;
        }
    }

    async select(id: string | null): Promise<void> {
        if (!id) { this.selected = null; return; }
        this.loading = true;
        try {
            this.selected = await releasesApi.get(id);
        } catch (err) {
            notifyError(err);
        } finally {
            this.loading = false;
        }
    }

    async create(): Promise<void> {
        const title = this.createTitle.trim();
        if (!title) return;
        this.saving = true;
        try {
            const created = await releasesApi.create(title, this.createDescription.trim() || undefined);
            this.createTitle = '';
            this.createDescription = '';
            await this.refresh();
            await this.select(created.id);
        } catch (err) {
            notifyError(err);
        } finally {
            this.saving = false;
        }
    }

    async attach(): Promise<void> {
        if (!this.selected || !this.attachId.trim()) return;
        const releaseId = this.selected.id;
        this.saving = true;
        try {
            await releasesApi.attach(releaseId, this.attachEntity, this.attachId.trim());
            this.attachId = '';
            await this.select(releaseId);
        } catch (err) {
            notifyError(err);
        } finally {
            this.saving = false;
        }
    }

    async detach(entity: ReleaseEntityKind, id: string): Promise<void> {
        if (!this.selected) return;
        const releaseId = this.selected.id;
        try {
            await releasesApi.detach(releaseId, entity, id);
            await this.select(releaseId);
        } catch (err) {
            notifyError(err);
        }
    }

    async deleteRelease(id: string): Promise<void> {
        try {
            await releasesApi.delete(id);
            if (this.selected?.id === id) this.selected = null;
            await this.refresh();
        } catch (err) {
            notifyError(err);
        }
    }

    async publish(): Promise<void> {
        if (!this.selected) return;
        const id = this.selected.id;
        const title = this.selected.title;
        this.saving = true;
        try {
            await notifyPromise(
                releasesApi.publish(id, this.selected.version),
                {
                    loading: `Publishing "${title}"…`,
                    success: () => `Release "${title}" published`,
                    error: (e) => `Publish failed: ${String((e as Error).message ?? e)}`,
                },
            );
            await this.refresh();
            await this.select(id);
        } catch {
            /* notifyPromise already surfaced */
        } finally {
            this.saving = false;
        }
    }

    async rollback(): Promise<void> {
        if (!this.selected) return;
        const id = this.selected.id;
        const title = this.selected.title;
        this.saving = true;
        try {
            const result = await notifyPromise(
                releasesApi.rollback(id),
                {
                    loading: `Rolling back "${title}"…`,
                    success: () => `Rolled back "${title}"`,
                    error: (e) => `Rollback failed: ${String((e as Error).message ?? e)}`,
                },
            );
            await this.refresh();
            await this.select(result.id);
        } catch {
            /* notifyPromise already surfaced */
        } finally {
            this.saving = false;
        }
    }
}
