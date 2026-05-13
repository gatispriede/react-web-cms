import React from 'react';
import type {TFunction} from 'i18next';
import {EItemType} from '@enums/EItemType';
import type {IItem} from '@interfaces/IItem';
import ContentManager from '@client/lib/ContentManager';
import {DEFAULT_PRODUCT_CONTENT} from './Product.types';
import type {IProductModule, IProductRenderable} from './Product.types';
import ProductFeatured from './ProductFeatured';
import ProductGrid from './ProductGrid';
import ProductCarousel from './ProductCarousel';
import ProductComparison from './ProductComparison';
import ProductRelated from './ProductRelated';

export {EProductStyle} from './Product.types';
export type {IProductModule} from './Product.types';

/**
 * ContentManager for the Product module. Defaults are merged at read time
 * so older stored blobs (missing newer mode-specific keys) still render.
 */
export class ProductContent extends ContentManager {
    public _parsedContent: IProductModule = {...DEFAULT_PRODUCT_CONTENT};
    get data(): IProductModule {
        this.parse();
        return {
            ...DEFAULT_PRODUCT_CONTENT,
            ...(this._parsedContent ?? {}),
        };
    }
    set data(v: IProductModule) { this._parsedContent = v; }
    setField<K extends keyof IProductModule>(k: K, v: IProductModule[K]) { this._parsedContent[k] = v; }
}

/**
 * Product module — mode-dispatching renderer.
 *
 * Hydration: in SSR the host page passes `pageProps.productData` into
 * `SectionContent`'s extras, keyed by item name. The renderer falls back
 * to an empty list — variants surface their empty-state UI. Wiring the
 * full SSR hydrator is part of the page renderer (out-of-scope for this
 * sub-jump; ships as part of sub-jump C's product-list integration).
 */
const Product: React.FC<{
    item: IItem;
    t: TFunction<'translation', undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
    /** Test seam — bypasses SSR data extras for unit tests. */
    products?: IProductRenderable[];
}> = ({item, products}) => {
    const config = new ProductContent(EItemType.Product, item.content).data;
    const renderables = products ?? [];

    switch (config.mode) {
        case 'featured':
            return <ProductFeatured config={config} products={renderables}/>;
        case 'carousel':
            return <ProductCarousel config={config} products={renderables}/>;
        case 'comparison':
            return <ProductComparison config={config} products={renderables}/>;
        case 'related':
            return <ProductRelated config={config} products={renderables}/>;
        case 'grid':
        default:
            return <ProductGrid config={config} products={renderables}/>;
    }
};

export default Product;
