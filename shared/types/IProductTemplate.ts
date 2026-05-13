/**
 * `IProductTemplate` — named, reusable section composition operators apply
 * to N products via `IProduct.templateId`. Phase 1.F
 * (product-display-templates).
 *
 * Templates live in the `ProductTemplates` Mongo collection. Five built-in
 * templates are seeded by `ProductTemplatesServiceLoader.onBoot` (see
 * `services/features/ProductTemplates/builtInTemplates.ts`).
 *
 * Built-in templates are not deletable — operators may duplicate them as
 * starting points for custom templates (`ProductTemplateService.duplicate`).
 * Deleting a custom template cascades to every product referencing it,
 * unsetting `IProduct.templateId` so the default fallback (`built-in:
 * standard`) kicks back in.
 */

import type {ISection} from './ISection';

/** Operator-facing audience filter for the template-picker. */
export type TemplateAudience = 'b2c' | 'b2b' | 'either';

export const TEMPLATE_AUDIENCES: readonly TemplateAudience[] = [
    'b2c',
    'b2b',
    'either',
];

/** Source discriminator on `IProduct` — mirrors `IProduct.source`. */
export type TemplateProductSource = 'manual' | 'warehouse';

export const TEMPLATE_PRODUCT_SOURCES: readonly TemplateProductSource[] = [
    'manual',
    'warehouse',
];

/**
 * Filter shape narrowing where a template appears in the product-form
 * picker. Empty / unset fields ⇒ "applies to everything".
 */
export interface IProductTemplateApplicability {
    /** Category slugs this template is appropriate for. */
    categories?: string[];
    /** Limits the template to one or both product `source` discriminators. */
    sources?: TemplateProductSource[];
}

export interface IProductTemplate {
    /** Stable, slug-friendly id. Built-ins use the `built-in:<slug>` prefix. */
    id: string;
    /** Human-readable name shown in the template-picker. */
    name: string;
    /** Operator-facing summary shown inline next to the picker. */
    description: string;
    /** Optional preview image — operator picks from the media library. */
    thumbnailImageId?: string;
    /** Audience hint — drives the picker's audience filter. */
    audience: TemplateAudience;
    /** Picker-narrowing filters. */
    applicableTo: IProductTemplateApplicability;
    /** The actual layout — same shape as `IPage.sections`. */
    sections: ISection[];
    /** True for platform-shipped templates; operators cannot delete these. */
    builtIn: boolean;
    /** ISO timestamps. */
    createdAt: string;
    updatedAt: string;
    /** Optimistic-concurrency counter — bumped server-side on every save. */
    version: number;
    editedBy?: string;
}

/** Write-side input shape — `id`/timestamps/version filled server-side. */
export interface InProductTemplate {
    id?: string;
    name: string;
    description?: string;
    thumbnailImageId?: string;
    audience?: TemplateAudience;
    applicableTo?: IProductTemplateApplicability;
    sections?: ISection[];
}
