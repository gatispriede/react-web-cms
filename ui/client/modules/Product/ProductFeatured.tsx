import React from 'react';
import type {IProductModule, IProductRenderable} from './Product.types';
import BuyCta from '@client/components/Commerce/BuyCta';
import ProductPrice from './ProductPrice';

/**
 * Featured variant — single product hero layout. Image position is
 * operator-controlled (left/right/top/background); mobile auto-stacks.
 */
const ProductFeatured: React.FC<{config: IProductModule; products: IProductRenderable[]}> = ({config, products}) => {
    const product = products[0];
    if (!product) return (
        <div className="product product--featured product--empty" data-testid="product-featured-empty">
            <p>No product selected.</p>
        </div>
    );
    const pos = config.featured?.imagePosition ?? 'left';
    return (
        <section
            className={`product product--featured product--featured-${pos}`}
            data-testid="product-featured"
            data-product-slug={product.slug}
        >
            {pos === 'background' && product.image && (
                <div className="product__bg" style={{backgroundImage: `url(${product.image.startsWith('http') ? product.image : '/' + product.image.replace(/^\//, '')})`}}/>
            )}
            {pos !== 'background' && product.image && (
                <div className="product__media">
                    <img src={product.image.startsWith('http') ? product.image : `/${product.image.replace(/^\//, '')}`} alt={product.title}/>
                </div>
            )}
            <div className="product__body">
                <h2 className="product__title">{product.title}</h2>
                {product.description && <p className="product__desc">{product.description}</p>}
                {config.showPrice !== false && (typeof product.price === 'number' || product.prices) && (
                    <p className="product__price">
                        <ProductPrice
                            prices={product.prices}
                            price={product.price}
                            currency={product.currency}
                            baseCurrency={product.baseCurrency}
                            testId="product-featured-price"
                        />
                    </p>
                )}
                {config.showBuyCta !== false && (
                    <BuyCta
                        product={product}
                        variant={config.featured?.ctaStyle ?? 'primary'}
                        label={config.featured?.ctaText}
                    />
                )}
            </div>
        </section>
    );
};

export default ProductFeatured;
