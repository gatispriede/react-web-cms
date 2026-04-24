import React from "react";
import ContentManager from "@client/lib/ContentManager";
import {EItemType} from "@enums/EItemType";
import {Image} from "antd";
import {IItem} from "@interfaces/IItem";
import {ETextPosition} from "@enums/ETextPosition";
import {TFunction} from "i18next";
import type {IGallery, IGalleryItem} from "./Gallery.types";
export type {IGallery, IGalleryItem} from "./Gallery.types";
export {EGalleryStyle} from "./Gallery.types";

export class GalleryContent extends ContentManager {
    public _parsedContent: IGallery = {
        items: [],
        disablePreview: false
    }

    get data(): IGallery {
        if (!this._parsedContent.items) {
            this._parsedContent.items = []
        }
        this.parse();
        return this._parsedContent
    }

    set data(value: IGallery) {
        this._parsedContent = value;
    }

    addItem(value?: IGalleryItem) {
        if (!this._parsedContent.items) {
            this._parsedContent.items = []
        }
        if (value) {
            this._parsedContent.items.push(value)
        } else {
            this._parsedContent.items.push({
                alt: '',
                height: 0,
                preview: true,
                src: '',
                text: '',
                imgWidth: '',
                imgHeight: '',
                textPosition: ETextPosition.Bottom
            })
        }
    }

    removeItem(index: number) {
        this._parsedContent.items.splice(index, 1)
    }

    setItem(index: number, value: IGalleryItem) {
        this._parsedContent.items[index] = value
    }

    setDisablePreview(value: boolean) {
        this._parsedContent.disablePreview = value
    }

    setAspectRatio(value: IGallery['aspectRatio']) {
        this._parsedContent.aspectRatio = value;
    }

    /** Swap two items in place — used by admin "move up / move down" buttons. */
    moveItem(from: number, to: number) {
        const items = this._parsedContent.items ?? [];
        if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return;
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
    }
}

const Gallery = ({item, t: _t, tApp}: {
    item: IItem,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}) => {
    const gallery = new GalleryContent(EItemType.Image, item.content);
    gallery.setDisablePreview(item.action !== "onClick");
    const data = gallery.data
    // Marquee/logo-wall/hazard-strip styles duplicate the item list so the
    // CSS scroll animation can loop seamlessly — the duplicate is
    // aria-hidden so screen readers don't announce every item twice.
    const isMarquee = item.style === 'marquee' || item.style === 'logo-wall' || item.style === 'hazard-strip';
    // Per-gallery aspect-ratio lock (C6). `free` — or missing — keeps the
    // historical default-style 3:2 ratio baked into the .default SCSS; any
    // explicit value overrides via `[data-aspect-ratio]` rules in Gallery.scss.
    const aspectRatio = data.aspectRatio && data.aspectRatio !== 'free' ? data.aspectRatio : undefined;
    // Only originals go into PreviewGroup — marquee clones render as plain
    // <img> tags outside the group so the preview counter stays at N/N (not
    // 2N/2N) and the nav doesn't double-step through duplicates.
    const renderTile = (galleryItem: IGalleryItem, index: number, isClone: boolean) => {
        const hasImage = Boolean(galleryItem.src);
        const imgStyle: React.CSSProperties = {};
        if (galleryItem.imgWidth) imgStyle.width = galleryItem.imgWidth;
        if (galleryItem.imgHeight) imgStyle.height = galleryItem.imgHeight;
        const inner = (
            <>
                {hasImage && (
                    <div className={'image'}>
                        {isClone ? (
                            <img src={'/' + galleryItem.src} alt={galleryItem.alt} style={imgStyle}/>
                        ) : (
                            <Image
                                preview={data.disablePreview ? false : galleryItem.preview}
                                src={'/' + galleryItem.src}
                                alt={galleryItem.alt}
                                width={galleryItem.imgWidth || undefined}
                                height={galleryItem.imgHeight || undefined}
                            />
                        )}
                    </div>
                )}
                {galleryItem.text && (
                    <div className={'text'}>
                        <p>{galleryItem.text}</p>
                    </div>
                )}
            </>
        );
        const containerClass = `container text-${galleryItem.textPosition}${hasImage ? '' : ' gallery-tile--text'}`;
        // A per-tile `href` wraps the whole tile in an anchor — the image
        // preview click is suppressed so the nav wins. Clones never link;
        // they exist purely to visually seam the marquee loop.
        if (galleryItem.href && !isClone) {
            return (
                <a
                    key={`o-${index}`}
                    className={`${containerClass} gallery-tile--link`}
                    href={galleryItem.href}
                    onClick={(e) => {
                        // Don't intercept clicks on the <Image> preview trigger —
                        // honour the anchor navigation instead.
                        e.stopPropagation();
                    }}
                >
                    {inner}
                </a>
            );
        }
        return (
            <div
                key={`${isClone ? 'c' : 'o'}-${index}`}
                className={containerClass}
                aria-hidden={isClone ? true : undefined}
            >
                {inner}
            </div>
        );
    };
    return (
        <div
            className={`gallery-wrapper gallery-wrapper-app ${item.style}`}
            data-aspect-ratio={aspectRatio}
            onClick={e => e.stopPropagation()}
        >
            <div className={'gallery-wrapper-images'}>
                <Image.PreviewGroup>
                    {data.items.map((it, i) => renderTile(it, i, false))}
                </Image.PreviewGroup>
                {isMarquee && data.items.map((it, i) => renderTile(it, i, true))}
            </div>
        </div>
    )
}

export default Gallery