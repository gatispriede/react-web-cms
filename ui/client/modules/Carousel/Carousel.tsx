import React from "react";
import ContentManager from "@client/lib/ContentManager";
import {EItemType} from "@enums/EItemType";
import {Carousel, Image} from "antd";
import {IItem} from "@interfaces/IItem";
import {ETextPosition} from "@enums/ETextPosition";
import {IGalleryItem, IGalleryItemLegacy} from "../Gallery/Gallery.types";
import {TFunction} from "i18next";
import type {ICarousel} from "./Carousel.types";
import {toImageRef} from "@interfaces/IImageRef";
import {toLinkRef} from "@interfaces/ILinkRef";
export type {ICarousel} from "./Carousel.types";
export {ECarouselStyle} from "./Carousel.types";

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
    if (r.link) item.link = toLinkRef(r.link);
    else if (r.href) item.link = toLinkRef(undefined, {url: r.href});
    return item;
};

export class CarouselContent extends ContentManager {
    public _parsedContent: ICarousel = {
        items: [],
        autoplay: false,
        infinity: false,
        autoplaySpeed: 3000,
        dots: false,
        arrows: false,
        disablePreview: false
    }

    get data(): ICarousel {
        this.parse();
        const c = this._parsedContent ?? {} as ICarousel;
        this._parsedContent = {
            items: Array.isArray(c.items) ? c.items.map(normalizeItem) : [],
            autoplay: !!c.autoplay,
            infinity: !!c.infinity,
            autoplaySpeed: c.autoplaySpeed ?? 3000,
            dots: !!c.dots,
            arrows: !!c.arrows,
            disablePreview: !!c.disablePreview,
        };
        return this._parsedContent;
    }

    set data(value: ICarousel) {
        this._parsedContent = value;
    }

    addItem(value?: IGalleryItem) {
        if (!this._parsedContent.items) this._parsedContent.items = [];
        this._parsedContent.items.push(value ?? defaultItem());
    }
    setAutoplay(value: boolean){ this._parsedContent.autoplay = value }
    setAutoplaySpeed(value: number){ this._parsedContent.autoplaySpeed = value }
    setInfinity(value: boolean){ this._parsedContent.infinity = value }
    setDots(value: boolean){ this._parsedContent.dots = value }
    setArrows(value: boolean){ this._parsedContent.arrows = value }
    removeItem(index: number) { this._parsedContent.items.splice(index, 1) }
    setItem(index: number, value: IGalleryItem) { this._parsedContent.items[index] = value }
    setDisablePreview(value: boolean) { this._parsedContent.disablePreview = value }
}

const CarouselView = ({item, t: _t, tApp: _tApp}: {
    item: IItem,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}) => {
    const gallery = new CarouselContent(EItemType.Image, item.content);
    gallery.setDisablePreview(item.action !== "onClick");
    const data = gallery.data;
    const children = data.items.map((it: IGalleryItem, index: number) => {
        const img = it.image;
        const src = img.src && (img.src.startsWith('/') || /^https?:\/\//.test(img.src)) ? img.src : `/${img.src}`;
        return (
            <li key={index} className={`container text-${it.textPosition}`}>
                <div
                    className={'image'}
                    data-sized={(img.width || img.height) ? true : undefined}
                >
                    <Image
                        preview={false}
                        src={src}
                        alt={img.alt}
                        width={img.width || undefined}
                        height={img.height || undefined}
                    />
                </div>
                {it.text && (
                    <div className={'text'}>
                        <p>{it.text}</p>
                    </div>
                )}
            </li>
        )
    })
    const styleClass = item.style && item.style !== 'default' ? ` ${item.style}` : '';
    return (
        <div >
            <div className={`carousel-wrapper${styleClass}`} style={{
                display: "block"
            }}>
                <Carousel autoplay={data.autoplay} autoplaySpeed={data.autoplaySpeed} arrows={data.arrows} infinite={data.infinity} dotPosition={'bottom'} dots={data.dots}>
                    {children}
                </Carousel>
            </div>
        </div>
    )
}

export default CarouselView
