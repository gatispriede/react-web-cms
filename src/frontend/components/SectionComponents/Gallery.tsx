import React from "react";
import ContentManager from "../ContentManager";
import {EItemType} from "../../../enums/EItemType";
import {Image} from "antd";
import {IItem} from "../../../Interfaces/IItem";
import {ETextPosition} from "../../../enums/ETextPosition";

export interface IGalleryItem {
    alt: string;
    height: number;
    preview: boolean;
    src: string;
    text: string;
    textPosition: ETextPosition;
}

export interface IGallery {
    items: IGalleryItem[];
    disablePreview: boolean;
}

export enum EGalleryStyle {
    Default = "default",
    BorderedAlignedByThree = "BorderedAlignedByThree"
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

const Gallery = ({item}: { item: IItem }) => {
    const gallery = new GalleryContent(EItemType.Image, item.content);
    gallery.setDisablePreview(item.action !== "onClick");
    const data = gallery.data
    return (
        <div className={`gallery-wrapper gallery-wrapper-app ${item.style}`}>
            <div className={'gallery-wrapper-mages'}>
                <Image.PreviewGroup>
                    {
                        data.items.map((item: IGalleryItem) => {
                            return (
                                <div className={`container text-${item.textPosition}`}>
                                    <div className={'image'}>
                                        <Image
                                            preview={data.disablePreview ? false : item.preview}
                                            src={item.src}
                                            alt={item.alt}
                                        />
                                    </div>
                                    <div className={'text'}>
                                        <p>{item.text}</p>
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