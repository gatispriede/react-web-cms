import React from 'react';
import type {IProductModule, IProductRenderable} from './Product.types';
import ProductCard from './ProductCard';

/**
 * Related variant — auto-populated grid. Hydration logic (which products
 * to surface given the rule + primary product) lives upstream in the
 * page renderer; this component just renders whatever the hydrator
 * supplied. Keeping the renderer agnostic lets the same component be
 * exercised against fixture data in tests.
 */
const ProductRelated: React.FC<{config: IProductModule; products: IProductRenderable[]}> = ({config, products}) => {
    if (products.length === 0) return (
        <div className="product product--related product--empty" data-testid="product-related-empty">
            <p>No related products.</p>
        </div>
    );
    return (
        <section className="product product--related" data-testid="product-related">
            <h3 className="product__heading">You may also like</h3>
            <div className="product--grid product--grid-cols-3" style={{['--product-grid-cols' as string]: 3}}>
                {products.map(p => (
                    <ProductCard
                        key={p.id}
                        product={p}
                        showBuyCta={config.showBuyCta !== false}
                        showPrice={config.showPrice !== false}
                    />
                ))}
            </div>
        </section>
    );
};

export default ProductRelated;
