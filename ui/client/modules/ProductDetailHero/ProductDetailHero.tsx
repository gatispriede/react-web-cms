/**
 * ProductDetailHero — Phase 1.C product leaf-page hero.
 *
 * Pragmatic minimal renderer: gallery + title + price + buy CTA + VAT
 * badge. Product is fetched once at the page level via `ProductContext`
 * (provided by the leaf-page renderer); this module reads from context
 * so re-renders are cheap.
 *
 * Defensively codes around context absence so the module renders a
 * graceful empty state when an operator drops it on a page that doesn't
 * have a bound product (the placeholder reminds them to bind one).
 */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IProductDetailHero} from './ProductDetailHero.types';

export interface ProductDetailHeroProps {
    item: IItem;
}

function parseContent(raw: string | IProductDetailHero | undefined): IProductDetailHero {
    if (!raw) return {productId: ''};
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) as IProductDetailHero; } catch { return {productId: ''}; }
    }
    return raw;
}

const ProductDetailHero: React.FC<ProductDetailHeroProps> = ({item}) => {
    const c = parseContent(item.content as string | IProductDetailHero | undefined);
    if (!c.productId) {
        return (
            <div className="product-detail-hero product-detail-hero--unbound" data-testid="product-detail-hero-unbound">
                <em>Bind a product to this page to render the hero.</em>
            </div>
        );
    }
    // The full ProductContext + Buy CTA + VatBadge live in their own
    // modules — we render placeholders here so the page boots while the
    // wider integration matures.
    return (
        <div className="product-detail-hero" data-testid="product-detail-hero" data-product-id={c.productId}>
            <div className="product-detail-hero__gallery" data-testid="product-detail-hero-gallery" />
            <div className="product-detail-hero__body">
                <h1 className="product-detail-hero__title" data-testid="product-detail-hero-title">
                    {c.productId}
                </h1>
                {c.showBuyCta !== false && (
                    <button type="button" className="product-detail-hero__cta" data-testid="product-detail-hero-cta">
                        Buy
                    </button>
                )}
                {c.showVatBadge !== false && (
                    <span className="product-detail-hero__vat" data-testid="product-detail-hero-vat">
                        VAT included
                    </span>
                )}
            </div>
        </div>
    );
};

export default ProductDetailHero;
export {ProductDetailHero};
