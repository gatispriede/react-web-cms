import {ClientUILoader, ClientPublicRoute} from '@client/lib/loaders/ClientUILoader';

/**
 * Products feature — public routes (Class Loader L4).
 *
 * Declares the Next.js paths this feature owns. The
 * `applyPublicGates`/`gateForPath` helper resolves a request URL back to
 * the owning feature id so each page can call `withFeatureGate` without
 * hard-coding the literal `'products'`.
 */
export class ProductsClientUILoader extends ClientUILoader {
    readonly id = 'products';
    readonly displayName = 'Products';

    readonly publicRoutes: readonly ClientPublicRoute[] = [
        {path: '/products'},
        {path: '/products/[slug]'},
    ];
}
