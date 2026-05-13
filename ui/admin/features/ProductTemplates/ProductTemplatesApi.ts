/**
 * Thin fetch wrapper for the admin Product Templates REST surface.
 * Mirrors `ReleasesApi`. Phase 1.F (product-display-templates).
 */
import type {IProductTemplate, InProductTemplate, TemplateAudience} from '@interfaces/IProductTemplate';

async function call<T>(op: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch('/api/product-templates', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({op, ...body}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? `productTemplates.${op} failed: ${res.status}`);
    return data as T;
}

export interface TemplateListItem extends IProductTemplate {
    usageCount?: number;
}

export const productTemplatesApi = {
    list: (opts: {audience?: TemplateAudience; includeUsage?: boolean} = {}) =>
        call<TemplateListItem[]>('list', opts as Record<string, unknown>),
    get: (id: string) => call<IProductTemplate>('get', {id}),
    create: (input: InProductTemplate) => call<IProductTemplate>('create', {input}),
    update: (id: string, patch: Partial<InProductTemplate>, expectedVersion?: number) =>
        call<IProductTemplate>('update', {id, patch, expectedVersion}),
    delete: (id: string) =>
        call<{trashId: string; cascadedProducts: number}>('delete', {id}),
    restore: (trashId: string) =>
        call<{templateId: string; restoredProducts: number}>('restore', {trashId}),
    duplicate: (fromId: string, newName?: string) =>
        call<IProductTemplate>('duplicate', {fromId, newName}),
    preview: (id: string, fixtureProductId?: string) =>
        call<{templateId: string; template: IProductTemplate; fixtureProductId: string | null; sections: unknown[]}>(
            'preview', {id, fixtureProductId}),
    setProductTemplate: (productId: string, templateId: string | null) =>
        call<{ok: true}>('setProductTemplate', {productId, templateId}),
};
