/**
 * `WarrantyInfo` — warranty terms block. Used by B2B and new-cars
 * templates. Reads `product.attributes.warrantyYears` /
 * `product.attributes.warrantyTerms` from `ProductContext` when present.
 * Phase 1.F (product-display-templates).
 */
export interface IWarrantyInfo {
    /** Override heading. Defaults to "Warranty". */
    title?: string;
    /** Hard-coded warranty body — overrides product attribute pull. */
    body?: string;
    /** Hard-coded warranty length in years — overrides product attribute pull. */
    years?: number;
}
