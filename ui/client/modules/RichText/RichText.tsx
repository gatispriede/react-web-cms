import React, {RefObject, useEffect} from "react";
import ContentManager from "@client/lib/ContentManager";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import {TFunction} from "i18next";
import {extractTranslationsFromHTML} from "@utils/translationsutils";
import {sanitizeHtml} from "@utils/sanitize";
import type {IRichText} from "./RichText.types";
export type {IRichText} from "./RichText.types";
export {ERichTextStyle} from "./RichText.types";

export class RichTextContent extends ContentManager {
    public _parsedContent: IRichText = {value: ''}

    get data(): IRichText {
        this.parse();
        return this._parsedContent
    }

    set data(value: IRichText) {
        this._parsedContent = value;
    }

    setValue(value: string) {
        this._parsedContent.value = value;
    }

}

const RichText = ({item, t, tApp}: {
    item: IItem,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}) => {
    const richTextContent = new RichTextContent(EItemType.RichText, item.content);
    const contentRef: RefObject<HTMLDivElement | null> = React.createRef();

    useEffect(() => {
        if(contentRef.current){
            const translated = extractTranslationsFromHTML(richTextContent.data.value, tApp)
            contentRef.current.innerHTML = sanitizeHtml(translated)
        }
    }, [contentRef, richTextContent.data.value, tApp]);
    return (
        <div className={`rich-text ${item.style}`}>
            <div ref={contentRef} />
        </div>
    )
}

export default RichText