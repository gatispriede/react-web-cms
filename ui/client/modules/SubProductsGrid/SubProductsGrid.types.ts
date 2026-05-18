/**
 * `SubProductsGrid` — sibling-products grid rendered under a parent
 * product. Used by the `Bundle` built-in product display template.
 * Phase 1.F (product-display-templates).
 */
export interface ISubProductsGrid {
    /** Optional grid heading; defaults to "Bundle contents". */
    title?: string;
    /** Maximum number of sibling products to render. Default 8. */
    limit?: number;
}
