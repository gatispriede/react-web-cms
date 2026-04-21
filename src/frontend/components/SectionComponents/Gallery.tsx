import React from "react";
import ContentManager from "../ContentManager";
import {EItemType} from "../../../enums/EItemType";
import {Image} from "antd";
import {IItem} from "../../../Interfaces/IItem";
import {ETextPosition} from "../../../enums/ETextPosition";
import {TFunction} from "i18next";

export interface IGalleryItem {
    alt: string;
    height: number;
    preview: boolean;
    src: string;
    text: string;
    imgWidth: string;
    imgHeight: string;
    textPosition: ETextPosition;
}

export interface IGallery {
    items: IGalleryItem[];
    disablePreview: boolean;
}

export enum EGalleryStyle {
    Default = "default",
    /** Infinite horizontal scroll strip (design-v2 marquee).
     *  Pauses on hover; duplicates items once via CSS to hide the wrap-seam. */
    Marquee = "marquee",
    /** Logo-wall variant — same marquee animation, no image text captions. */
    LogoWall = "logo-wall",
    /** Thin top-bar hazard-strip ticker (design-v4 Industrial) — accent-bg,
     *  uppercase labels with bullet dots. Uses the `text` field; `src` ignored. */
    HazardStrip = "hazard-strip",
}

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
    // Only originals go into PreviewGroup — marquee clones render as plain
    // <img> tags outside the group so the preview counter stays at N/N (not
    // 2N/2N) and the nav doesn't double-step through duplicates.
    const renderTile = (galleryItem: IGalleryItem, index: number, isClone: boolean) => {
        const hasImage = Boolean(galleryItem.src);
        const imgStyle: React.CSSProperties = {};
        if (galleryItem.imgWidth) imgStyle.width = galleryItem.imgWidth;
        if (galleryItem.imgHeight) imgStyle.height = galleryItem.imgHeight;
        return (
            <div
                key={`${isClone ? 'c' : 'o'}-${index}`}
                className={`container text-${galleryItem.textPosition}${hasImage ? '' : ' gallery-tile--text'}`}
                aria-hidden={isClone ? true : undefined}
            >
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
            </div>
        );
    };
    return (
        <div
            className={`gallery-wrapper gallery-wrapper-app ${item.style}`}
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