import React from 'react';
import type {IProductModule, IProductRenderable} from './Product.types';
import ProductCard from './ProductCard';

/**
 * Carousel variant — horizontal snap-scroll. Pure CSS scroll-snap so the
 * implementation is JS-free + accessible by keyboard tab order. Arrow
 * controls / autoplay are visual sugar; they remain inert without JS so
 * the no-JS render is still usable.
 */
const ProductCarousel: React.FC<{config: IProductModule; products: IProductRenderable[]}> = ({config, products}) => {
    const slides = config.carousel?.slidesPerView ?? 3;
    if (products.length === 0) return (
        <div className="product product--carousel product--empty" data-testid="product-carousel-empty">
            <p>No products to display.</p>
        </div>
    );
    return (
        <section className="product product--carousel" data-testid="product-carousel">
            <div
                className="product__track"
                style={{['--product-carousel-slides' as string]: slides}}
            >
                {products.map(p => (
                    <div key={p.id} className="product__slide">
                        <ProductCard
                            product={p}
                            showBuyCta={config.showBuyCta !== false}
                            showPrice={config.showPrice !== false}
                        />
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ProductCarousel;
