import React from "react";
import ContentManager from "../../helpers/ContentManager";
import {EItemType} from "../../../enums/EItemType";
import {Image} from "antd";

export interface IPlainImage {
    src: string;
    alt: string;
    height: number;
    preview: boolean
}

export class PlainImageContent extends ContentManager {
    public _parsedContent: IPlainImage = {alt: "", height: 0, preview: false, src: ""}
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

}

const PlainImage = ({content}:{content: string}) => {
    const plainImage = new PlainImageContent(EItemType.Image, content);
    return (
        <div className={'plain-image'}>
            <Image src={plainImage.data.src} preview={plainImage.data.preview ? plainImage.data.preview : true} />
        </div>
    )
}

export default PlainImage