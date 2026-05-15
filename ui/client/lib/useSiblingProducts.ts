/**
 * `useSiblingProducts(product, limit)` — client-side hook used by the
 * `SubProductsGrid` storefront module. Phase 1.F follow-up
 * (product-display-templates).
 *
 * Calls `ProductApi.list` and filters in the client. The grid is small
 * (typically ≤8 items) so a server-side `/api/products/<id>/siblings`
 * endpoint is not warranted yet — a category fetch + filter is cheap
 * and reuses the cached gqty path.
 *
 * Resolution order mirrors `ProductService.listSiblings`:
 *   1. Same explicit `bundleParentId` (sibling-of-sibling).
 *   2. Children of this product (other products with
 *      `bundleParentId === product.id`).
 *   3. Category fallback — same first category.
 *
 * State is rendered through React's basic useState/useEffect — the
 * VM4 ban on `useState` applies to admin views; storefront modules use
 * React idiomatically.
 */
import {useEffect, useState} from 'react';
import ProductApi from '@services/api/client/ProductApi';
import type {IProductRenderable} from '@client/modules/Product/Product.types';
import type {IProduct} from '@interfaces/IProduct';

export interface UseSiblingProductsResult {
    loading: boolean;
    siblings: IProductRenderable[];
}

function toRenderable(p: IProduct): IProductRenderable {
    return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        description: p.description,
        price: p.price,
        currency: p.currency,
        image: (p.images && p.images[0]) || undefined,
        attributes: p.attributes,
    };
}

/** Fetch + memoise sibling products for a given parent. */
export function useSiblingProducts(
    product: {id: string; bundleParentId?: string; categories?: string[]} | null | undefined,
    limit = 8,
): UseSiblingProductsResult {
    const [loading, setLoading] = useState<boolean>(!!product);
    const [siblings, setSiblings] = useState<IProductRenderable[]>([]);

    useEffect(() => {
        let cancelled = false;
        if (!product) { setLoading(false); setSiblings([]); return; }
        setLoading(true);
        (async () => {
            const api = new ProductApi();
            // Strategy: pull a generous slice of the same category and
            // filter client-side. Cheap for typical catalogues; for
            // bundle relationships the server-side `listSiblings` MCP
            // tool / API can be wired later if needed.
            const cat = Array.isArray(product.categories) ? product.categories[0] : undefined;
            const fetched = cat
                ? await api.list({category: cat, limit: Math.max(limit * 4, 24)})
                : await api.list({limit: Math.max(limit * 4, 24)});

            const sameParent = product.bundleParentId
                ? fetched.filter(p => p.bundleParentId === product.bundleParentId && p.id !== product.id)
                : [];
            const children = fetched.filter(p => p.bundleParentId === product.id);
            const categoryFallback = fetched.filter(p => p.id !== product.id);

            const pickFrom = sameParent.length > 0
                ? sameParent
                : children.length > 0
                    ? children
                    : categoryFallback;

            if (!cancelled) {
                setSiblings(pickFrom.slice(0, limit).map(toRenderable));
                setLoading(false);
            }
        })().catch(() => {
            if (!cancelled) { setSiblings([]); setLoading(false); }
        });
        return () => { cancelled = true; };
    }, [product, limit]);

    return {loading, siblings};
}
