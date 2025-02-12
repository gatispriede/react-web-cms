import React from "react";
import ContentManager from "../ContentManager";
import {EItemType} from "../../../enums/EItemType";
import {Image} from "antd";
import {IItem} from "../../../Interfaces/IItem";

export interface IPlainImage {
    src: string;
    description: string;
    alt: string;
    height: number;
    preview: boolean
}

export class PlainImageContent extends ContentManager {
    public _parsedContent: IPlainImage = {alt: "", height: 0, preview: false, src: "", description: ""}
    get data(): IPlainImage {
        this.parse();
        return this._parsedContent
    }
    set data(value: IPlainImage){
        this._parsedContent = value;
    }
    setSrc(value: string){
        this._parsedContent.src = value;
    }
    setDescription(value: string){
        this._parsedContent.description = value;
    }

}

const PlainImage = ({item}:{item: IItem}) => {
    const plainImage = new PlainImageContent(EItemType.Image, item.content);
    const preview = plainImage.data.preview ? plainImage.data.preview : typeof item.action !== "string"
    return (
        <div className={'plain-image'}>
            <Image preview={preview} src={plainImage.data.src} />
        </div>
    )
}

export default PlainImage