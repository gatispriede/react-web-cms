import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {ProductTemplateService} from './ProductTemplateService';

/**
 * ProductTemplates Loader — Phase 1.F (product-display-templates).
 *
 * Owns `ProductTemplateService` — CRUD over `IProductTemplate` rows +
 * cascade-on-delete to reset `IProduct.templateId` references. The
 * `onBoot` hook upserts the 5 built-in templates idempotently so
 * platform updates land without operator action.
 */
export class ProductTemplatesServiceLoader extends ServiceLoader {
    readonly id = 'productTemplates';
    readonly displayName = 'Product Templates';
    /** Depends on Products to ensure the cascade target collection exists. */
    readonly requires = ['products'] as const;

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {productTemplates: new ProductTemplateService(ctx.db)};
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        {
            collection: 'ProductTemplates',
            spec: {id: 1},
            options: {unique: true, name: 'productTemplates_id_unique'},
        },
        {
            collection: 'ProductTemplates',
            spec: {audience: 1, name: 1},
            options: {name: 'productTemplates_audience_name'},
        },
        // Product-side index supporting cascade-on-delete + the picker
        // usage-count lookup. Sparse — most products won't have an
        // explicit templateId set.
        {
            collection: 'Products',
            spec: {templateId: 1},
            options: {name: 'products_templateId', sparse: true},
        },
    ];

    async onBoot(ctx: FeatureContext): Promise<void> {
        const svc = ctx.services.productTemplates as ProductTemplateService;
        await svc.seedBuiltIns();
    }
}
