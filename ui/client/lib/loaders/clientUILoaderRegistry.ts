import type {ClientItemType, ClientPublicRoute} from './ClientUILoader';
import {ClientUILoader} from './ClientUILoader';

import {ProductsClientUILoader} from '@client/features/Products/ProductsClientUILoader';
import {PostsClientUILoader} from '@client/features/Posts/PostsClientUILoader';
import {CartClientUILoader} from '@client/features/Cart/CartClientUILoader';
import {OrdersClientUILoader} from '@client/features/Orders/OrdersClientUILoader';

/**
 * Client UI loader registry — Class Loader L4 (2026-05-03).
 *
 * Mirrors `adminUILoaderRegistry.ts` on the public-site bundle. Each
 * migrated feature exports a `<X>ClientUILoader.ts` that declares the
 * public routes it owns and (eventually) the module renderers it
 * contributes. The registry collects those declarations so route gates
 * and module-type lookups become data-driven rather than per-page wired.
 *
 * Migration is feature-by-feature; pages whose feature isn't registered
 * here keep their inline `withFeatureGate(literalId, …)` call until the
 * loader lands.
 */
const REGISTERED: ClientUILoader[] = [
    new ProductsClientUILoader(),
    new PostsClientUILoader(),
    new CartClientUILoader(),
    new OrdersClientUILoader(),
];

/** Every registered ClientUILoader — for low-level walkers. */
export function listClientUILoaders(): readonly ClientUILoader[] {
    return REGISTERED;
}

/** Flat list of every registered public route across features. */
export function listPublicRoutes(): readonly (ClientPublicRoute & {featureId: string})[] {
    const out: (ClientPublicRoute & {featureId: string})[] = [];
    for (const loader of REGISTERED) {
        for (const r of loader.publicRoutes ?? []) {
            out.push({...r, featureId: r.gate ?? loader.id});
        }
    }
    return out;
}

/** Flat list of every registered module item-type renderer. */
export function listClientItemTypes(): readonly ClientItemType[] {
    const out: ClientItemType[] = [];
    for (const loader of REGISTERED) {
        for (const it of loader.itemTypes ?? []) out.push(it);
    }
    return out;
}
