import React, {useContext} from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {translateOrKeep} from "@utils/translateOrKeep";
import {ProductContext} from "@client/lib/ProductContext";
import {toImageRef, IImageRef} from "@interfaces/IImageRef";
import type {ILargeGallery} from "./LargeGallery.types";
export type {ILargeGallery} from "./LargeGallery.types";

const normalize = (raw: ILargeGallery | undefined): ILargeGallery => {
    const r = (raw ?? {}) as ILargeGallery;
    return {
        title: r.title ?? '',
        images: Array.isArray(r.images) ? r.images.map(img => toImageRef(img)) : undefined,
    };
};

export class LargeGalleryContent extends ContentManager {
    public _parsedContent: ILargeGallery = {};
    get data(): ILargeGallery {
        this.parse();
        this._parsedContent = normalize(this._parsedContent as ILargeGallery);
        return this._parsedContent;
    }
    set data(v: ILargeGallery) { this._parsedContent = v; }
    setField<K extends keyof ILargeGallery>(k: K, v: ILargeGallery[K]) {
        this._parsedContent[k] = v;
    }
}

/** Coerce a raw `product.images: string[]` into the IImageRef[] our renderer needs. */
const productImagesAsRefs = (images: string[] | undefined): IImageRef[] => {
    if (!images || !images.length) return [];
    return images.map(src => toImageRef(src));
};

const resolveSrc = (src: string | undefined): string => {
    if (!src) return '';
    return src.startsWith('/') || /^https?:/.test(src) ? src : `/${src}`;
};

const LargeGallery: React.FC<{
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin?: boolean;
}> = ({item, tApp}) => {
    const c = new LargeGalleryContent(EItemType.LargeGallery, item.content).data;
    const product = useContext(ProductContext)?.product;
    const tr = (v: string) => translateOrKeep(tApp, v);
    const images: IImageRef[] = (c.images && c.images.length > 0)
        ? c.images
        : productImagesAsRefs(product?.images);
    if (!images.length) return null;
    return (
        <section
            className={`large-gallery ${item.style ?? ''}`}
            data-testid={`module-large-gallery-${item.name || ''}`}
        >
            {c.title && (
                <h2 className="large-gallery__title" data-testid="large-gallery-title">
                    {tr(c.title)}
                </h2>
            )}
            <div className="large-gallery__grid">
                {images.map((img, i) => (
                    <figure
                        key={i}
                        className="large-gallery__tile"
                        data-testid={`large-gallery-tile-${i}`}
                    >
                        <img
                            src={resolveSrc(img.src)}
                            alt={img.alt ?? ''}
                            loading="lazy"
                        />
                    </figure>
                ))}
            </div>
        </section>
    );
};

export default LargeGallery;
