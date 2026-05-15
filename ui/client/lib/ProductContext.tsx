import React from 'react';
import type {IProduct} from '@interfaces/IProduct';

/**
 * `ProductContext` — leaf-product-page binding for child modules.
 *
 * The leaf-product page renderer (Phase 1.C → 1.F dispatch shim) wraps
 * the section list in `<ProductContext.Provider value={{product, currency, vatRegime}}>`
 * so `LargeGallery`, `SubProductsGrid`, `DownloadablePdf`, `WarrantyInfo`,
 * `ProductDetailHero`, `ProductSpecTable`, etc. read product data without
 * each refetching.
 *
 * Context default is `null` — modules MUST defensive-check before
 * dereferencing (operators may drop these modules on pages that don't
 * bind a product, e.g. a marketing landing page).
 */
export interface ProductContextValue {
    product: IProduct;
    /** Active currency ISO-4217 — picked by the SSR currency middleware. */
    currency: string;
    /** Active VAT regime — operator's per-region rate; see Orders/tax.ts. */
    vatRegime?: string;
}

export const ProductContext = React.createContext<ProductContextValue | null>(null);
