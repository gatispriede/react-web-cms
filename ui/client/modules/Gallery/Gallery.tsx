import React, {useState} from "react";
import ContentManager from "@client/lib/ContentManager";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import {ETextPosition} from "@enums/ETextPosition";
import {TFunction} from "i18next";
import type {IGallery, IGalleryItem, IGalleryItemLegacy} from "./Gallery.types";
import SizedImage from "@client/lib/SizedImage";
import {toImageRef} from "@interfaces/IImageRef";
import {toLinkRef} from "@interfaces/ILinkRef";
import {inlineEditAttr} from "@client/lib/inlineEditAttr";
import GalleryLightbox from "./GalleryLightbox";
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
    // `showCaptions` defaults to `true` — alt-as-caption is the new baseline.
    showCaptions: raw?.showCaptions ?? true,
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

    setShowCaptions(value: boolean) {
        this._parsedContent.showCaptions = value;
    }

    moveItem(from: number, to: number) {
        const items = this._parsedContent.items ?? [];
        if (from < 0 || to < 0 || from >= items.length || to >= items.length || from === to) return;
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
    }
}

const Gallery = ({item, t: _t, tApp: _tApp, admin}: {
    item: IItem,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>,
    admin?: boolean,
}) => {
    const editId = item.name || EItemType.Image;
    const gallery = new GalleryContent(EItemType.Image, item.content);
    gallery.setDisablePreview(item.action !== "onClick");
    const data = gallery.data
    const isMarquee = item.style === 'marquee' || item.style === 'logo-wall' || item.style === 'hazard-strip';
    const aspectRatio = data.aspectRatio && data.aspectRatio !== 'free' ? data.aspectRatio : undefined;
    const showCaptions = data.showCaptions !== false;

    // Lightbox eligibility: previews not disabled by the section action, the
    // tile carries a `preview` flag, and it actually has an image. The
    // lightbox cycles only over this filtered subset, so the index it works
    // with is a position in `previewable`, not in `data.items`.
    const lightboxEnabled = !data.disablePreview;
    const previewable = data.items
        .map((it, i) => ({it, i}))
        .filter(({it}) => it.preview !== false && Boolean(it.image.src));
    // -1 = lightbox closed (matches the GalleryLightbox `index` contract).
    const [lightboxIndex, setLightboxIndex] = useState(-1);

    const openLightbox = (galleryIndex: number) => {
        const pos = previewable.findIndex(({i}) => i === galleryIndex);
        if (pos >= 0) setLightboxIndex(pos);
    };

    const renderTile = (galleryItem: IGalleryItem, index: number, isClone: boolean) => {
        const img = galleryItem.image;
        const hasImage = Boolean(img.src);
        const imgStyle: React.CSSProperties = {};
        if (img.width) imgStyle.width = typeof img.width === 'number' ? `${img.width}px` : img.width;
        if (img.height) imgStyle.height = typeof img.height === 'number' ? `${img.height}px` : img.height;
        // Caption: with `showCaptions` on, `alt` is the primary label (always
        // meaningful for client photo reels) and `text` becomes an optional
        // secondary line. With it off, only the explicit `text` shows — the
        // legacy behaviour. Legacy galleries with no `alt` still surface
        // `text` as the primary line so nothing disappears.
        const captionPrimary = showCaptions ? (img.alt || galleryItem.text) : galleryItem.text;
        const captionSecondary = showCaptions && img.alt ? galleryItem.text : '';
        const tileClickable = !isClone && lightboxEnabled && hasImage && galleryItem.preview !== false;
        const inner = (
            <>
                {hasImage && (
                    <div
                        className={'image'}
                        data-sized={(img.width || img.height) ? true : undefined}
                    >
                        {/* `.ant-image` span kept as a structural alias so the
                            existing Gallery.scss + per-theme variant selectors
                            (which target `.image .ant-image`) keep matching.
                            The image itself is now a plain lazy `<img>` — the
                            AntD `<Image>` preview is superseded by the
                            dedicated `GalleryLightbox`. */}
                        <span className={'ant-image'}>
                            <SizedImage
                                src={'/' + img.src}
                                alt={img.alt}
                                width={img.width || undefined}
                                height={img.height || undefined}
                                style={imgStyle}
                                loading={'lazy'}
                                decoding={'async'}
                            />
                        </span>
                    </div>
                )}
                {captionPrimary && (
                    <div className={'text'}>
                        <p {...inlineEditAttr(admin, editId, `items.${index}.text`)}>{captionPrimary}</p>
                        {captionSecondary && (
                            <p className={'text-secondary'}>{captionSecondary}</p>
                        )}
                    </div>
                )}
            </>
        );
        const containerClass = `container text-${galleryItem.textPosition}${hasImage ? '' : ' gallery-tile--text'}${tileClickable ? ' gallery-tile--zoom' : ''}`;
        const testId = `gallery-tile-${index}`;
        const linkUrl = galleryItem.link?.url;
        if (linkUrl && !isClone) {
            return (
                <a
                    key={`o-${index}`}
                    className={`${containerClass} gallery-tile--link`}
                    href={linkUrl}
                    aria-label={galleryItem.link?.label || undefined}
                    data-testid={testId}
                    onClick={(e) => {
                        e.stopPropagation();
                    }}
                >
                    {inner}
                </a>
            );
        }
        if (tileClickable) {
            return (
                <button
                    key={`o-${index}`}
                    type={'button'}
                    className={containerClass}
                    data-testid={testId}
                    aria-label={(captionPrimary || img.alt || 'Open image') as string}
                    onClick={(e) => {
                        e.stopPropagation();
                        openLightbox(index);
                    }}
                >
                    {inner}
                </button>
            );
        }
        return (
            <div
                key={`${isClone ? 'c' : 'o'}-${index}`}
                className={containerClass}
                data-testid={isClone ? undefined : testId}
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
            data-testid={'gallery'}
            onClick={e => e.stopPropagation()}
        >
            <div className={'gallery-wrapper-images'}>
                {data.items.map((it, i) => renderTile(it, i, false))}
                {isMarquee && data.items.map((it, i) => renderTile(it, i, true))}
            </div>
            <GalleryLightbox
                items={previewable.map(({it}) => it)}
                index={lightboxIndex}
                onClose={() => setLightboxIndex(-1)}
                onNavigate={setLightboxIndex}
            />
        </div>
    )
}

export default Gallery
