import React, {useContext} from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "@utils/translateOrKeep";
import {ProductContext} from "@client/lib/ProductContext";
import {useSiblingProducts} from "@client/lib/useSiblingProducts";
import ProductCard from "@client/modules/Product/ProductCard";
import type {ISubProductsGrid} from "./SubProductsGrid.types";
export type {ISubProductsGrid} from "./SubProductsGrid.types";

const normalize = (raw: ISubProductsGrid | undefined): ISubProductsGrid => {
    const r = (raw ?? {}) as ISubProductsGrid;
    return {
        title: r.title ?? 'Bundle contents',
        limit: typeof r.limit === 'number' && r.limit > 0 ? r.limit : 8,
    };
};

export class SubProductsGridContent extends ContentManager {
    public _parsedContent: ISubProductsGrid = {};
    get data(): ISubProductsGrid {
        this.parse();
        this._parsedContent = normalize(this._parsedContent as ISubProductsGrid);
        return this._parsedContent;
    }
    set data(v: ISubProductsGrid) { this._parsedContent = v; }
    setField<K extends keyof ISubProductsGrid>(k: K, v: ISubProductsGrid[K]) {
        this._parsedContent[k] = v;
    }
}

const SubProductsGrid: React.FC<{
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
}> = ({item, tApp}) => {
    const c = new SubProductsGridContent(EItemType.SubProductsGrid, item.content).data;
    const product = useContext(ProductContext)?.product;
    const tr = (v: string) => translateOrKeep(tApp, v);

    // Phase 1.F follow-up — sibling-products fetch. Hook resolves
    // bundle-parent / explicit-children / category-fallback in that
    // order. Renders ProductCard primitives from the Phase 1.B Product
    // module so all storefront cards share one component.
    const {loading, siblings} = useSiblingProducts(product as any, c.limit);

    if (!product) {
        return (
            <section
                className="sub-products-grid sub-products-grid--unbound"
                data-testid="module-sub-products-grid-unbound"
            >
                <em>{tr('Bind a parent product to render its bundle contents.')}</em>
            </section>
        );
    }

    return (
        <section
            className={`sub-products-grid ${item.style ?? ''}`}
            data-testid="sub-products-grid"
        >
            {c.title && (
                <h2 className="sub-products-grid__title" data-testid="sub-products-grid-title">
                    {tr(c.title)}
                </h2>
            )}
            {loading ? (
                <div
                    className="sub-products-grid__loading"
                    data-testid="sub-products-grid-loading"
                    aria-busy="true"
                >
                    {tr('Loading related items…')}
                </div>
            ) : siblings.length === 0 ? (
                <div
                    className="sub-products-grid__empty"
                    data-testid="sub-products-grid-empty"
                >
                    {tr('No related items')}
                </div>
            ) : (
                <div
                    className="sub-products-grid__grid"
                    data-testid="sub-products-grid-list"
                    data-parent-sku={product.sku}
                    data-limit={c.limit}
                >
                    {siblings.map(s => (
                        <div key={s.id} data-testid={`sub-product-card-${s.id}`}>
                            <ProductCard product={s} showBuyCta showPrice density="compact"/>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
};

export default SubProductsGrid;
