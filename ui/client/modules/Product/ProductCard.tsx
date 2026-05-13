import React from 'react';
import type {IProductRenderable} from './Product.types';
import BuyCta from '@client/components/Commerce/BuyCta';

/**
 * Shared product card primitive — consumed by ProductGrid, ProductCarousel,
 * ProductRelated. Catalogue-only when `showBuyCta` is false or
 * `commerce.checkoutEnabled` is false (BuyCta self-suppresses).
 */
export interface ProductCardProps {
    product: IProductRenderable;
    showBuyCta?: boolean;
    showPrice?: boolean;
    density?: 'compact' | 'standard' | 'spacious';
}

const ProductCard: React.FC<ProductCardProps> = ({product, showBuyCta = true, showPrice = true, density = 'standard'}) => {
    const href = `/products/${product.slug}`;
    return (
        <article
            className={`product-card product-card--${density}`}
            data-testid={`product-card-${product.slug}`}
        >
            <a className="product-card__media" href={href}>
                {product.image ? (
                    <img src={product.image.startsWith('http') ? product.image : `/${product.image.replace(/^\//, '')}`} alt={product.title}/>
                ) : (
                    <div className="product-card__placeholder" aria-hidden="true"/>
                )}
            </a>
            <div className="product-card__body">
                <h3 className="product-card__title">
                    <a href={href} data-testid={`product-card-link-${product.slug}`}>{product.title}</a>
                </h3>
                {showPrice && typeof product.price === 'number' && (
                    <p className="product-card__price" data-testid={`product-card-price-${product.slug}`}>
                        {(product.price / 100).toFixed(2)} {product.currency ?? 'EUR'}
                    </p>
                )}
                {showBuyCta && <BuyCta product={product} variant="card"/>}
            </div>
        </article>
    );
};

export default ProductCard;
