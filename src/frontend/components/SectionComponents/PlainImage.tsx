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
    useAsBackground: boolean
    preview: boolean
}

export class PlainImageContent extends ContentManager {
    public _parsedContent: IPlainImage = {
        alt: "",
        height: 0,
        useAsBackground: false,
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

    setUseAsBackground(value: boolean) {
        this._parsedContent.useAsBackground = value;
    }

}

const PlainImage = ({item}: { item: IItem }) => {
    const plainImage = new PlainImageContent(EItemType.Image, item.content);
    const preview = plainImage.data.preview ? plainImage.data.preview : typeof item.action !== "string"
    const contentRef: RefObject<HTMLDivElement | null> = React.createRef();
    useEffect(() => {
        if (contentRef.current && !plainImage.data.useAsBackground) {
            contentRef.current.innerHTML = draftToHtml(plainImage.data.description)
        }
    }, [plainImage.data.description]);
    return (
        <>
            {
                plainImage.data.useAsBackground ? <div className={'background-image'}>
                    <div style={{backgroundImage: `url(${plainImage.data.src})`}}></div>
                </div> : <div className={'plain-image'}>
                    <Image preview={preview} src={plainImage.data.src}/>
                    <div ref={contentRef}></div>
                </div>
            }
        </>
    )
}

export default PlainImage