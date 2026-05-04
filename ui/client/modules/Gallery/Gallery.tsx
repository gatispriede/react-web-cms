import React from "react";
import ContentManager from "@client/lib/ContentManager";
import {EItemType} from "@enums/EItemType";
import {Image} from "antd";
import {IItem} from "@interfaces/IItem";
import {ETextPosition} from "@enums/ETextPosition";
import {TFunction} from "i18next";
import type {IGallery, IGalleryItem, IGalleryItemLegacy} from "./Gallery.types";
import SizedImage from "@client/lib/SizedImage";
import {toImageRef} from "@interfaces/IImageRef";
import {toLinkRef} from "@interfaces/ILinkRef";
export type {IGallery, IGalleryItem} from "./Gallery.types";
export {EGalleryStyle} from "./Gallery.types";

const defaultItem = (): IGalleryItem => ({
    image: {src: ''},
    preview: true,
    text: '',
    textPosition: ETextPosition.Bottom,
});

const normalizeItem = (raw: IGalleryItem | IGalleryItemLegacy | undefined): IGalleryItem => {
    const r = (raw ?? {}) as IGalleryItemLegacy;
    const image = toImageRef(r.image, {
        src: r.src,
        alt: r.alt,
        width: r.imgWidth,
        height: r.imgHeight,
    });
    const item: IGalleryItem = {
        image,
        preview: r.preview ?? true,
        text: r.text ?? '',
        textPosition: r.textPosition ?? ETextPosition.Bottom,
    };
    if (r.link) {
        item.link = toLinkRef(r.link);
    } else if (r.href) {
        item.link = toLinkRef(undefined, {url: r.href});
    }
    return item;
};

const normalize = (raw: IGallery | undefined): IGallery => ({
    items: Array.isArray(raw?.items) ? raw!.items.map(normalizeItem) : [],
    disablePreview: !!raw?.disablePreview,
    aspectRatio: raw?.aspectRatio,
});

export class GalleryContent extends ContentManager {
    public _parsedContent: IGallery = {items: [], disablePreview: false};

    get data(): IGallery {
        this.parse();
        this._parsedContent = normalize(this._parsedContent);
        return this._parsedContent;
    }

    set data(value: IGallery) {
        this._parsedContent = value;
    }

    addItem(value?: IGalleryItem) {
        if (!this._parsedContent.items) this._parsedContent.items = [];
        this._parsedContent.items.push(value ?? defaultItem());
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

    moveItem(from: number, to: number) {
        const items = this._parsedContent.items ?? [];
        if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return;
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
    }
}

const Gallery = ({item, t: _t, tApp: _tApp}: {
    item: IItem,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}) => {
    const gallery = new GalleryContent(EItemType.Image, item.content);
    gallery.setDisablePreview(item.action !== "onClick");
    const data = gallery.data
    const isMarquee = item.style === 'marquee' || item.style === 'logo-wall' || item.style === 'hazard-strip';
    const aspectRatio = data.aspectRatio && data.aspectRatio !== 'free' ? data.aspectRatio : undefined;
    const renderTile = (galleryItem: IGalleryItem, index: number, isClone: boolean) => {
        const img = galleryItem.image;
        const hasImage = Boolean(img.src);
        const imgStyle: React.CSSProperties = {};
        if (img.width) imgStyle.width = typeof img.width === 'number' ? `${img.width}px` : img.width;
        if (img.height) imgStyle.height = typeof img.height === 'number' ? `${img.height}px` : img.height;
        const inner = (
            <>
                {hasImage && (
                    <div
                        className={'image'}
                        data-sized={(img.width || img.height) ? true : undefined}
                    >
                        {isClone ? (
                            <SizedImage
                                src={'/' + img.src}
                                alt={img.alt}
                                width={img.width || undefined}
                                height={img.height || undefined}
                                style={imgStyle}
                            />
                        ) : (
                            <Image
                                preview={data.disablePreview ? false : galleryItem.preview}
                                src={'/' + img.src}
                                alt={img.alt}
                                width={img.width || undefined}
                                height={img.height || undefined}
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
        const linkUrl = galleryItem.link?.url;
        if (linkUrl && !isClone) {
            return (
                <a
                    key={`o-${index}`}
                    className={`${containerClass} gallery-tile--link`}
                    href={linkUrl}
                    aria-label={galleryItem.link?.label || undefined}
                    onClick={(e) => {
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
