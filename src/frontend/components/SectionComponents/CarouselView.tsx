import React from "react";
import ContentManager from "../ContentManager";
import {EItemType} from "../../../enums/EItemType";
import {Carousel, Image} from "antd";
import {IItem} from "../../../Interfaces/IItem";
import {ETextPosition} from "../../../enums/ETextPosition";
import {IGalleryItem} from "./Gallery";


export interface ICarousel {
    items: IGalleryItem[];
    autoplay: boolean;
    infinity: boolean;
    autoplaySpeed: number;
    dots: boolean;
    arrows: boolean;
    disablePreview: boolean;
}

export enum ECarouselStyle {
    Default = "default",
}

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
        if(!this._parsedContent.items){
            this._parsedContent.items = []
        }
        this.parse();
        return this._parsedContent
    }

    set data(value: ICarousel) {
        this._parsedContent = value;
    }

    addItem(value?: IGalleryItem) {
        if(!this._parsedContent.items){
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
                imgHeight: '',
                imgWidth: '',
                textPosition: ETextPosition.Bottom
            })
        }
    }
    setAutoplay(value: boolean){
        this._parsedContent.autoplay = value
    }
    setAutoplaySpeed(value: number){
        this._parsedContent.autoplaySpeed = value
    }
    setInfinity(value: boolean){
        this._parsedContent.infinity = value
    }

    setDots(value: boolean){
        this._parsedContent.dots = value
    }

    setArrows(value: boolean){
        this._parsedContent.arrows = value
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

const CarouselView = ({item}: { item: IItem }) => {
    const gallery = new CarouselContent(EItemType.Image, item.content);
    gallery.setDisablePreview(item.action !== "onClick");
    const data = gallery.data;
    const children= data.items.map((item: IGalleryItem, index: number) => {
        return (
            <li key={index} className={`container text-${item.textPosition}`}>
                <div className={'image'}>
                    <Image
                        preview={false}
                        src={item.src}
                        alt={item.alt}
                    />
                </div>
                <div className={'text'}>
                    <p>{item.text}</p>
                </div>
            </li>
        )
    })
    return (
        <div >
            <div className={'carousel-wrapper'} style={{
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