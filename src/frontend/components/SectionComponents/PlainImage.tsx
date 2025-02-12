import React, {RefObject, useEffect, useRef} from "react";
import ContentManager from "../ContentManager";
import {EItemType} from "../../../enums/EItemType";
import {Image} from "antd";
import {IItem} from "../../../Interfaces/IItem";
import draftToHtml from 'draftjs-to-html';
import {RawDraftContentState} from "draft-js";

export interface IPlainImage {
    src: string;
    description: RawDraftContentState;
    alt: string;
    height: number;
    preview: boolean
}

export class PlainImageContent extends ContentManager {
    public _parsedContent: IPlainImage = {
        alt: "",
        height: 0,
        preview: false,
        src: "",
        description: {
            blocks: [],
            entityMap: {}
        }
    }

    get data(): IPlainImage {
        this.parse();
        return this._parsedContent
    }

    set data(value: IPlainImage) {
        this._parsedContent = value;
    }

    setSrc(value: string) {
        this._parsedContent.src = value;
    }

    setDescription(value: RawDraftContentState) {
        this._parsedContent.description = value;
    }

}

const PlainImage = ({item}: { item: IItem }) => {
    const plainImage = new PlainImageContent(EItemType.Image, item.content);
    const preview = plainImage.data.preview ? plainImage.data.preview : typeof item.action !== "string"
    const contentRef: RefObject<HTMLDivElement | null> = React.createRef();
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.innerHTML = draftToHtml(plainImage.data.description)
        }
    }, [plainImage.data.description]);
    return (
        <div className={'plain-image'}>
            <Image preview={preview} src={plainImage.data.src}/>
            <div ref={contentRef}></div>
        </div>
    )
}

export default PlainImage