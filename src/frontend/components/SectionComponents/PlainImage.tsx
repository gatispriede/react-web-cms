import React, {RefObject, useEffect, useRef, useState} from "react";
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
    useGradiant: boolean
    offsetX: number
    preview: boolean
}

export class PlainImageContent extends ContentManager {
    public _parsedContent: IPlainImage = {
        alt: "",
        height: 0,
        useAsBackground: false,
        useGradiant: false,
        offsetX: 0,
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
    setUseGradiant(value: boolean) {
        this._parsedContent.useGradiant = value;
    }
    setOffsetX(value: number) {
        this._parsedContent.offsetX = value;
    }

}

const PlainImage = ({item}: { item: IItem }) => {
    const plainImage = new PlainImageContent(EItemType.Image, item.content);
    const preview = plainImage.data.preview ? plainImage.data.preview : typeof item.action !== "string"
    const contentRef: RefObject<HTMLDivElement | null> = React.createRef();
    const [minHeight, setMinHeight] = useState(500)
    useEffect(() => {
        if (contentRef.current && !plainImage.data.useAsBackground) {
            contentRef.current.innerHTML = draftToHtml(plainImage.data.description)
        }
    }, [plainImage.data.description]);
    let backgroundProperty = `url(${plainImage.data.src})`
    if(plainImage.data.useGradiant){
        backgroundProperty = `linear-gradient(to top, rgb(255 255 255 / 0%) 95%, rgb(255 255 255)), url(${plainImage.data.src})`
    }

    useEffect(() => {
        const bodyHeight = document.body.getBoundingClientRect().height;
        const windowHeight = window.screen.height;
        if(bodyHeight > windowHeight) {
            setMinHeight(bodyHeight)
        }else{
            setMinHeight(windowHeight)
        }
    }, [window, document]);
    return (
        <>
            {
                plainImage.data.useAsBackground
                    ?
                    <div className={'background-image'} style={{
                        marginTop: `${plainImage.data.offsetX}px`,
                        backgroundImage: backgroundProperty,
                        minHeight: minHeight
                    }} />
                    :
                    <div className={'plain-image'}>
                        <Image preview={preview} src={plainImage.data.src} style={{
                            marginTop: `${plainImage.data.offsetX}px`
                        }}/>
                        <div ref={contentRef}></div>
                    </div>
            }
        </>
    )
}

export default PlainImage