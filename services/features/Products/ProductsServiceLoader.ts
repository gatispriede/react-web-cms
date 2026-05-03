import {ServiceLoader} from '@services/infra/ServiceLoader';
import type {FeatureAuthzContribution, FeatureContext, FeatureIndexSpec} from '@services/infra/featureManifest';
import {ProductService} from './ProductService';

/**
 * ProductsServiceLoader — Class Loader L2 proof case.
 *
 * First feature migrated to the new class-based authoring described in
 * `docs/features/platform/class-loader.md`. Replaces the literal
 * `productsFeature: FeatureManifest` (now re-exported from this loader
 * via `feature.manifest.ts` for the codegen scan).
 *
 * Why Products first:
 *   - Service-only ownership (Option A from the original Phase B move
 *     in `service-modularity.md`) — resolvers stay on the guarded
 *     `mongo` proxy, so the loader doesn't have to deal with resolver
 *     bindings yet.
 *   - SDL + authz already extracted into the Phase C.2 sweep — those
 *     literals translate verbatim to the loader's class fields.
 *   - No customer-session methods, no inline owner-based authz — the
 *     simplest non-trivial feature.
 *
 * The migration is shape-equivalent: every field on the literal
 * manifest is a field on this class. `toManifest()` (inherited from
 * ServiceLoader) recreates the same manifest object the registry has
 * been consuming. E2E + unit tests should be green without further
 * change.
 */
export class ProductsServiceLoader extends ServiceLoader {
    readonly id = 'products';
    readonly displayName = 'Products';

    buildServices(ctx: FeatureContext): Record<string, unknown> {
        return {products: new ProductService(ctx.db)};
    }

    readonly indexes: readonly FeatureIndexSpec[] = [
        // Mirrored from `ProductService.ensureIndexes()`. The in-class
        // call stays as-is (idempotent) so unit tests that instantiate
        // ProductService directly still get the indexes without going
        // through the registry.
        {collection: 'Products', spec: {id: 1}, options: {unique: true}},
        {collection: 'Products', spec: {slug: 1}, options: {unique: true}},
        {collection: 'Products', spec: {sku: 1}, options: {unique: true}},
        // Sparse so manual products (no externalId) don't collide on
        // the unique constraint — only warehouse rows participate.
        {collection: 'Products', spec: {externalId: 1}, options: {unique: true, sparse: true}},
        {collection: 'Products', spec: {categories: 1}},
        {collection: 'Products', spec: {draft: 1, publishedAt: -1}},
    ];

    readonly schemaSDL = `extend type QueryMongo {
    getProducts(includeDrafts: Boolean, limit: Int, category: String, inStockOnly: Boolean, source: String): String!
    getProduct(slug: String!, includeDrafts: Boolean): String
    searchProducts(q: String!, limit: Int, includeDrafts: Boolean): String!
}
extend type MutationMongo {
    saveProduct(product: JSON!, expectedVersion: Int): String!
    deleteProduct(id: String!): String!
    setProductPublished(id: String!, publish: Boolean!): String!
}`;

    readonly authz: FeatureAuthzContribution = {
        mutationRequirements: {
            saveProduct: 'admin',
            deleteProduct: 'admin',
            setProductPublished: 'admin',
        },
        sessionInjected: [
            'saveProduct',
            'deleteProduct',
            'setProductPublished',
        ],
        // Q10 — Products has no per-page surface (catalog grid lives at a
        // single admin route), so the gate is the feature dimension only.
        // Locale-scoped translators don't get product mutation rights.
        resourceGated: {
            saveProduct: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Products'},
            }),
            deleteProduct: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Products'},
            }),
            setProductPublished: () => ({
                dimensions: ['feature'] as const,
                values: {feature: 'Products'},
            }),
        },
    };
}
