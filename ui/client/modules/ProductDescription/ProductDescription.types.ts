/**
 * Phase 1.C — ProductDescription types.
 * RichText specialisation that auto-binds to `product.description` via
 * `ProductContext`. Operators can override the body inline.
 */
export interface IProductDescription {
    productId: string;
    /** When set (after operator override), this body wins. Otherwise the
     *  renderer pulls from `product.description`. */
    body?: string;
    /** Auto-bind target — only `'product.description'` is supported in
     *  this jump. Predefined Select. */
    autoBindTo?: 'product.description';
}

export enum EProductDescriptionStyle {
    Default = 'default',
}
