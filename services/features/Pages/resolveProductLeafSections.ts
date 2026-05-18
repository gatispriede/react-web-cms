/**
 * `resolveProductLeafSections` — Phase 1.F (product-display-templates)
 * leaf-product-page render-dispatch shim.
 *
 * Pure resolver invoked by the leaf product page renderer ABOVE the
 * section render. Order of precedence:
 *
 *   1. If `page.sections` differs structurally from the resolved
 *      template's section fingerprint → operator edited the leaf page
 *      directly → `page.sections` win (per-product override).
 *   2. Otherwise → bind product data onto the template's sections via
 *      `ProductTemplateService.applyTemplate` (returns a deep clone).
 *
 * Template resolution:
 *   - `product.templateId` (when set) → that specific template.
 *   - Unset / unknown → `built-in:standard` fallback.
 *
 * Phase 1.C's `buildProductDetailTemplate` remains the canonical
 * default for warehouse-sync's INITIAL page creation; this resolver
 * only kicks in at render time when an operator has explicitly assigned
 * a template via `IProduct.templateId`.
 */

import type {IProduct} from '@interfaces/IProduct';
import type {IPage} from '@interfaces/IPage';
import type {ISection} from '@interfaces/ISection';
import type {IProductTemplate} from '@interfaces/IProductTemplate';
import type {ProductTemplateService} from '@services/features/ProductTemplates/ProductTemplateService';
import {fingerprintProductDetailTemplate} from './ProductDetailTemplate';

export interface ResolveProductLeafInput {
    product: IProduct;
    /** The IPage row for the leaf product page (source = 'product'). */
    page: Pick<IPage, 'sections'> & {sections?: ISection[]};
    templateService: ProductTemplateService;
}

/**
 * Resolve the final section list. Returns `{template, sections, overridden}`:
 *   - `template` — the template the renderer wraps in `<ProductContext>`
 *     for downstream module data binding.
 *   - `sections` — the deep-cloned, ready-to-render section list.
 *   - `overridden` — `true` when the operator's per-product edits win.
 */
export async function resolveProductLeafSections(
    input: ResolveProductLeafInput,
): Promise<{template: IProductTemplate; sections: ISection[]; overridden: boolean}> {
    const template = await input.templateService.getOrDefault(input.product.templateId);
    const pageSections = input.page.sections ?? [];

    if (pageSections.length > 0) {
        const pageFp = fingerprintProductDetailTemplate(pageSections);
        const templateFp = fingerprintProductDetailTemplate(template.sections);
        if (pageFp !== templateFp) {
            // Operator-edited leaf — per-product override wins.
            return {template, sections: pageSections, overridden: true};
        }
    }

    return {
        template,
        sections: input.templateService.applyTemplate(template, input.product),
        overridden: false,
    };
}
