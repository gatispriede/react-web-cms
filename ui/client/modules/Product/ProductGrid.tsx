import React from 'react';
import type {IProductModule, IProductRenderable} from './Product.types';
import ProductCard from './ProductCard';

/**
 * Grid variant — N×M product cards. Mobile auto-falls to 2 columns via
 * CSS (`product--grid-cols-N` token-driven). Density tunes inner padding.
 */
const ProductGrid: React.FC<{config: IProductModule; products: IProductRenderable[]}> = ({config, products}) => {
    const cols = config.grid?.columns ?? 3;
    const density = config.grid?.density ?? 'standard';
    if (products.length === 0) return (
        <div className="product product--grid product--empty" data-testid="product-grid-empty">
            <p>No products to display.</p>
        </div>
    );
    return (
        <section
            className={`product product--grid product--grid-cols-${cols}`}
            data-testid="product-grid"
            style={{['--product-grid-cols' as string]: cols}}
        >
            {products.map(p => (
                <ProductCard
                    key={p.id}
                    product={p}
                    showBuyCta={config.showBuyCta !== false}
                    showPrice={config.showPrice !== false}
                    density={density}
                />
            ))}
        </section>
    );
};

export default ProductGrid;
