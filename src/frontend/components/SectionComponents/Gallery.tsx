import React from "react";
import ContentManager from "../ContentManager";
import {EItemType} from "../../../enums/EItemType";
import {Image} from "antd";
import {IItem} from "../../../Interfaces/IItem";
import {ETextPosition} from "../../../enums/ETextPosition";
import {TFunction} from "i18next";
import {sanitizeKey} from "../../../utils/stringFunctions";

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
    const renderedItems = isMarquee ? [...data.items, ...data.items] : data.items;
    return (
        <div className={`gallery-wrapper gallery-wrapper-app ${item.style}`}>
            <div className={'gallery-wrapper-images'}>
                <Image.PreviewGroup>
                    {
                        renderedItems.map((item: IGalleryItem, index: number) => {
                            const isClone = isMarquee && index >= data.items.length;
                            const imgProperties: {
                                preview: boolean;
                                src: string;
                                alt: string;
                                width?: string;
                                height?: string;
                            } = {
                                preview: data.disablePreview ? false : item.preview,
                                src: '/' + item.src,
                                alt: item.alt
                            }
                            if(item.imgWidth && item.imgWidth.length > 0){
                                imgProperties.width = item.imgWidth
                            }
                            if(item.imgHeight && item.imgHeight.length > 0){
                                imgProperties.height = item.imgHeight
                            }
                            return (
                                <div
                                    key={index}
                                    className={`container text-${item.textPosition}`}
                                    aria-hidden={isClone ? true : undefined}
                                >
                                    <div className={'image'}>
                                        <Image {...imgProperties}/>
                                    </div>
                                    <div className={'text'}>
                                        <p>{tApp(sanitizeKey(item.text))}</p>
                                    </div>
                                </div>
                            )
                        })
                    }
                </Image.PreviewGroup>
            </div>
        </div>
    )
}

export default Gallery