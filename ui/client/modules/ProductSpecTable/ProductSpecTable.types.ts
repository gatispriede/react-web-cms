/**
 * Phase 1.C — ProductSpecTable types.
 * Two-column key-value table sourced from `IProduct.attributes`.
 * Label resolution: i18n key `product.spec.{attributeKey}`,
 * falling back to humanised key (snake_case → Title Case).
 */
export interface IProductSpecTable {
    /** Bound product id — pulled from `ProductContext` at render time. */
    productId: string;
    /** Default true. When false, the operator supplies explicit rows
     *  (override mode — useful for legal-spec tables that need precise
     *  ordering or rich values). */
    autoFromAttributes?: boolean;
    /** Override rows — only consumed when `autoFromAttributes === false`. */
    rows?: Array<{label: string; value: string}>;
}

export enum EProductSpecTableStyle {
    Default = 'default',
    Compact = 'compact',
    Striped = 'striped',
    Cards = 'cards',
    Dense = 'dense',
}
