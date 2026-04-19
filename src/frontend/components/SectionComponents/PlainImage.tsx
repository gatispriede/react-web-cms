import React, {RefObject, useEffect, useState} from "react";
import ContentManager from "../ContentManager";
import {EItemType} from "../../../enums/EItemType";
import {Image} from "antd";
import {IItem} from "../../../Interfaces/IItem";
import {TFunction} from "i18next";
import {extractTranslationsFromHTML} from "../../../utils/translationsutils";

export interface IPlainImage {
    src: string;
    description: string;
    alt: string;
    height: number;
    useAsBackground: boolean
    imageFixed: boolean
    useGradiant: boolean
    offsetX: number
    imgWidth: string
    imgHeight: string
    preview: boolean
}

export enum EImageStyle {
    Default = "default"
}

interface IImgProperties {
    preview: boolean,
    src: string,
    style: React.CSSProperties,
    width?: string,
    height?: string,
}

export class PlainImageContent extends ContentManager {
    public _parsedContent: IPlainImage = {
        alt: "",
        height: 0,
        useAsBackground: false,
        imageFixed: false,
        useGradiant: false,
        offsetX: 0,
        imgWidth: '',
        imgHeight: '',
        preview: false,
        src: "",
        description: ''
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

    setDescription(value: string) {
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
    setImgWidth(value: string) {
        this._parsedContent.imgWidth = value;
    }
    setImgHeight(value: string) {
        this._parsedContent.imgHeight = value;
    }
    setImageFixed(value: boolean) {
        this._parsedContent.imageFixed = value;
    }

}

const PlainImage = ({item, t: _t, tApp, admin}: {
    item: IItem,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>,
    admin?: boolean,
}) => {
    const plainImage = new PlainImageContent(EItemType.Image, item.content);
    const preview = plainImage.data.preview ? plainImage.data.preview : typeof item.action !== "string"
    const contentRef: RefObject<HTMLDivElement | null> = React.createRef();
    const [minHeight, setMinHeight] = useState(500)
    useEffect(() => {
        if (contentRef.current && !plainImage.data.useAsBackground) {
            contentRef.current.innerHTML = extractTranslationsFromHTML(plainImage.data.description, tApp)
        }
    }, [contentRef,plainImage.data.description, plainImage.data.useAsBackground, tApp]);
    let backgroundProperty = `url(/${plainImage.data.src})`
    if(plainImage.data.useGradiant){
        backgroundProperty = `linear-gradient(to top, rgb(255 255 255 / 0%) 95%, rgb(255 255 255)), url(/${plainImage.data.src})`
    }

    useEffect(() => {
        const bodyHeight = document.body.getBoundingClientRect().height;
        const windowHeight = window.screen.height;
        if(bodyHeight > windowHeight) {
            setMinHeight(bodyHeight)
        }else{
            setMinHeight(windowHeight)
        }
    }, []);
    const imgProperties: IImgProperties = {
        preview: preview,
        src: '/' + plainImage.data.src,
        style: {
            marginTop: `${plainImage.data.offsetX}px`
        }
    }
    if(plainImage.data.imgWidth && plainImage.data.imgWidth.length > 0){
        imgProperties.width = plainImage.data.imgWidth
    }
    if(plainImage.data.imgHeight && plainImage.data.imgHeight.length > 0){
        imgProperties.height = plainImage.data.imgHeight
    }
    return (
        <>
            {
                plainImage.data.useAsBackground
                    ?
                    <div className={`background-image is-fullbleed ${plainImage.data.imageFixed && 'fixed'}`} style={{
                        marginTop: `${plainImage.data.offsetX}px`,
                        backgroundImage: backgroundProperty,
                        backgroundSize: plainImage.data.imgWidth,
                        height: minHeight,
                        position: 'relative',
                    }}>
                        {admin && plainImage.data.src && (
                            <div
                                title={`/${plainImage.data.src}`}
                                style={{
                                    position: 'absolute',
                                    top: 8,
                                    left: 8,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '4px 8px 4px 4px',
                                    background: 'rgba(0,0,0,0.65)',
                                    color: '#fff',
                                    borderRadius: 6,
                                    fontSize: 11,
                                    lineHeight: 1.2,
                                    maxWidth: 'min(480px, 90%)',
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                                }}
                            >
                                <img
                                    src={`/${plainImage.data.src}`}
                                    alt=""
                                    style={{width: 28, height: 28, objectFit: 'cover', borderRadius: 4, flex: '0 0 auto'}}
                                />
                                <span style={{display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden'}}>
                                    <span style={{opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.3}}>Background image</span>
                                    <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                        {plainImage.data.src}
                                    </span>
                                </span>
                            </div>
                        )}
                    </div>
                    :
                    <div className={`plain-image ${item.style}`}>
                        <Image {...imgProperties}/>
                        <div className={'content'}>
                            <div ref={contentRef}></div>
                        </div>
                    </div>
            }
        </>
    )
}

export default PlainImage