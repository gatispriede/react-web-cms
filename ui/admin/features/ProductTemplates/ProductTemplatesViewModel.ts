/**
 * Product Templates admin pane state. Phase 1.F (product-display-templates).
 *
 * Backed by `/api/product-templates`. Long-running flows (save / delete)
 * wrap in Sonner `notifyPromise` so loading + success + failure render
 * uniformly. VM4 — no `useState` in the view component.
 */
import {observable} from '@client/lib/state/observable';
import {notifyDestructive, notifyError, notifyPromise, notifySuccess} from '@admin/lib/notify';
import type {IProductTemplate, InProductTemplate, TemplateAudience} from '@interfaces/IProductTemplate';
import type {ISection} from '@interfaces/ISection';
import {TEMPLATE_AUDIENCES} from '@interfaces/IProductTemplate';
import {productTemplatesApi, type TemplateListItem} from './ProductTemplatesApi';

export const AUDIENCE_OPTIONS = TEMPLATE_AUDIENCES.map(a => ({label: a, value: a}));

export class ProductTemplatesViewModel {
    list: TemplateListItem[] = [];
    selected: IProductTemplate | null = null;
    loading = false;
    saving = false;

    // Create form
    createName = '';
    createAudience: TemplateAudience = 'either';

    // Detail form (mirrors selected)
    editName = '';
    editDescription = '';
    editAudience: TemplateAudience = 'either';

    constructor() {
        return observable(this);
    }

    setCreateName(v: string): void { this.createName = v; }
    setCreateAudience(v: TemplateAudience): void { this.createAudience = v; }
    setEditName(v: string): void { this.editName = v; }
    setEditDescription(v: string): void { this.editDescription = v; }
    setEditAudience(v: TemplateAudience): void { this.editAudience = v; }

    async refresh(): Promise<void> {
        this.loading = true;
        try {
            this.list = await productTemplatesApi.list({includeUsage: true});
            if (this.selected) {
                this.selected = await productTemplatesApi.get(this.selected.id);
                this.bindEditForm();
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
            this.selected = await productTemplatesApi.get(id);
            this.bindEditForm();
        } catch (err) {
            notifyError(err);
        } finally {
            this.loading = false;
        }
    }

    private bindEditForm(): void {
        if (!this.selected) return;
        this.editName = this.selected.name;
        this.editDescription = this.selected.description;
        this.editAudience = this.selected.audience;
    }

    async create(): Promise<void> {
        const name = this.createName.trim();
        if (!name) return;
        this.saving = true;
        try {
            const input: InProductTemplate = {name, audience: this.createAudience};
            const created = await notifyPromise(
                productTemplatesApi.create(input),
                {loading: 'Creating template…', success: 'Template created', error: 'Failed to create'},
            );
            this.createName = '';
            await this.refresh();
            await this.select(created.id);
        } finally {
            this.saving = false;
        }
    }

    async save(): Promise<void> {
        if (!this.selected) return;
        this.saving = true;
        try {
            const updated = await notifyPromise(
                productTemplatesApi.update(this.selected.id, {
                    name: this.editName.trim(),
                    description: this.editDescription.trim(),
                    audience: this.editAudience,
                }, this.selected.version),
                {loading: 'Saving template…', success: 'Template saved', error: 'Save failed'},
            );
            this.selected = updated;
            this.bindEditForm();
            await this.refresh();
        } finally {
            this.saving = false;
        }
    }

    async duplicate(): Promise<void> {
        if (!this.selected) return;
        const dup = await notifyPromise(
            productTemplatesApi.duplicate(this.selected.id, `${this.selected.name} (copy)`),
            {loading: 'Duplicating…', success: 'Duplicated', error: 'Duplicate failed'},
        );
        await this.refresh();
        await this.select(dup.id);
    }

    async deleteSelected(): Promise<void> {
        if (!this.selected) return;
        if (this.selected.builtIn) {
            notifyError(new Error('Built-in templates cannot be deleted — duplicate first.'));
            return;
        }
        const id = this.selected.id;
        const name = this.selected.name;
        try {
            const res = await productTemplatesApi.delete(id);
            this.selected = null;
            await this.refresh();
            notifyDestructive(
                `Template "${name}" deleted. ${res.cascadedProducts} product(s) reset.`,
                () => void this.restore(res.trashId),
            );
        } catch (err) {
            notifyError(err);
        }
    }

    /** Sonner-Undo callback — re-create the template + re-link affected products. */
    async restore(trashId: string): Promise<void> {
        try {
            const res = await productTemplatesApi.restore(trashId);
            notifySuccess(`Restored — ${res.restoredProducts} product(s) re-linked`);
            await this.refresh();
            await this.select(res.templateId);
        } catch (err) {
            notifyError(err);
        }
    }

    /**
     * Persist a structural section-list edit on the selected template.
     * Built-ins reject server-side (`ProductTemplateService.update` guards
     * `sections` for `builtIn:true`); the UI already disables the editor
     * upstream, this is the wire-through for the inline section editor.
     */
    async saveSections(sections: ISection[]): Promise<void> {
        if (!this.selected) return;
        if (this.selected.builtIn) {
            notifyError(new Error('Built-in templates cannot be edited — duplicate first.'));
            return;
        }
        this.saving = true;
        try {
            const updated = await notifyPromise(
                productTemplatesApi.update(this.selected.id, {sections}, this.selected.version),
                {loading: 'Saving sections…', success: 'Sections saved', error: 'Save failed'},
            );
            this.selected = updated;
            this.bindEditForm();
            await this.refresh();
        } finally {
            this.saving = false;
        }
    }
}
