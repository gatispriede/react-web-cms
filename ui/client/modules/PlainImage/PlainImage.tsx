import React, {RefObject, useEffect, useState} from "react";
import ContentManager from "@client/lib/ContentManager";
import {EItemType} from "@enums/EItemType";
import {Image} from "antd";
import {IItem} from "@interfaces/IItem";
import {TFunction} from "i18next";
import {extractTranslationsFromHTML} from "@utils/translationsutils";
import {IImageRef, toImageRef} from "@interfaces/IImageRef";
import type {IPlainImage, IPlainImageLegacy} from "./PlainImage.types";
export type {IPlainImage} from "./PlainImage.types";
export {EImageStyle} from "./PlainImage.types";

interface IImgProperties {
    preview: boolean,
    src: string,
    style: React.CSSProperties,
    width?: string | number,
    height?: string | number,
}

const defaults = (): IPlainImage => ({
    image: {src: ''},
    description: '',
    useAsBackground: false,
    imageFixed: false,
    useGradiant: false,
    offsetX: 0,
    preview: false,
});

// Reads either the new {image: IImageRef} shape or the pre-C18 flat shape
// (`src`, `imgWidth`, `imgHeight`, `alt`) and always returns the new shape.
const normalize = (raw: IPlainImage | IPlainImageLegacy | undefined): IPlainImage => {
    const r = raw ?? {};
    const legacy = r as IPlainImageLegacy;
    const image = toImageRef(legacy.image, {
        src: legacy.src ?? '',
        alt: legacy.alt,
        width: legacy.imgWidth,
        height: legacy.imgHeight,
    });
    return {
        ...defaults(),
        ...(r as Partial<IPlainImage>),
        image,
    };
};

export class PlainImageContent extends ContentManager {
    public _parsedContent: IPlainImage = defaults();

    get data(): IPlainImage {
        this.parse();
        this._parsedContent = normalize(this._parsedContent as unknown as IPlainImage | IPlainImageLegacy);
        return this._parsedContent;
    }

    set data(value: IPlainImage) {
        this._parsedContent = value;
    }

    setImage(value: IImageRef) { this._parsedContent.image = value; }
    setSrc(value: string) {
        const cur = this._parsedContent.image ?? {src: ''};
        this._parsedContent.image = {...cur, src: value};
    }
    setDescription(value: string) { this._parsedContent.description = value; }
    setUseAsBackground(value: boolean) { this._parsedContent.useAsBackground = value; }
    setUseGradiant(value: boolean) { this._parsedContent.useGradiant = value; }
    setOffsetX(value: number) { this._parsedContent.offsetX = value; }
    setImgWidth(value: string) {
        const cur = this._parsedContent.image ?? {src: ''};
        this._parsedContent.image = {...cur, width: value || undefined};
    }
    setImgHeight(value: string) {
        const cur = this._parsedContent.image ?? {src: ''};
        this._parsedContent.image = {...cur, height: value || undefined};
    }
    setImageFixed(value: boolean) { this._parsedContent.imageFixed = value; }
}

const PlainImage = ({item, t: _t, tApp, admin}: {
    item: IItem,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>,
    admin?: boolean,
}) => {
    const plainImage = new PlainImageContent(EItemType.Image, item.content);
    const data = plainImage.data;
    const img = data.image;
    const preview = data.preview ? data.preview : typeof item.action !== "string"
    const contentRef: RefObject<HTMLDivElement | null> = React.createRef();
    const [minHeight, setMinHeight] = useState(500)
    useEffect(() => {
        if (contentRef.current && !data.useAsBackground) {
            contentRef.current.innerHTML = extractTranslationsFromHTML(data.description, tApp)
        }
    }, [contentRef, data.description, data.useAsBackground, tApp]);
    let backgroundProperty = `url(/${img.src})`
    if (data.useGradiant) {
        backgroundProperty = `linear-gradient(to top, rgb(255 255 255 / 0%) 95%, rgb(255 255 255)), url(/${img.src})`
    }

    useEffect(() => {
        const bodyHeight = document.body.getBoundingClientRect().height;
        const windowHeight = window.screen.height;
        if (bodyHeight > windowHeight) {
            setMinHeight(bodyHeight)
        } else {
            setMinHeight(windowHeight)
        }
    }, []);
    const imgProperties: IImgProperties = {
        preview: preview,
        src: '/' + img.src,
        style: {
            marginTop: `${data.offsetX}px`
        }
    }
    if (img.width) imgProperties.width = img.width;
    if (img.height) imgProperties.height = img.height;
    const bgSizeWidth = typeof img.width === 'string' && img.width.length > 0 ? img.width : 'cover';
    return (
        <>
            {
                data.useAsBackground
                    ?
                    <div className={`background-image ${data.imageFixed ? 'fixed' : ''}`} style={{
                        backgroundImage: backgroundProperty,
                        backgroundSize: bgSizeWidth,
                        backgroundPosition: 'center',
                        position: data.imageFixed ? 'fixed' : 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: data.imageFixed ? '100vh' : minHeight,
                        zIndex: -1,
                        pointerEvents: 'none',
                    }}>
                        {admin && img.src && (
                            <div
                                title={`/${img.src}`}
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
                                    src={`/${img.src}`}
                                    alt={img.alt ?? ''}
                                    style={{width: 28, height: 28, objectFit: 'cover', borderRadius: 4, flex: '0 0 auto'}}
                                />
                                <span style={{display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden'}}>
                                    <span style={{opacity: 0.75, textTransform: 'uppercase', letterSpacing: 0.3}}>Background image</span>
                                    <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                                        {img.src}
                                    </span>
                                </span>
                            </div>
                        )}
                    </div>
                    :
                    <div className={`plain-image ${item.style}`}>
                        <Image alt={img.alt} {...imgProperties}/>
                        <div className={'content'}>
                            <div ref={contentRef}></div>
                        </div>
                    </div>
            }
        </>
    )
}

export default PlainImage
