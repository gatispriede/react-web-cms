import React, {RefObject, useEffect} from "react";
import ContentManager from "../ContentManager";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import {RawDraftContentState} from "draft-js";
import draftToHtml from "draftjs-to-html";
import {TFunction} from "i18next";

export interface IRichText {
    value: RawDraftContentState;
}

export enum ERichTextStyle {
    Default = "default",
    CenteredBoxed = "centeredBoxed"
}

export class RichTextContent extends ContentManager {
    public _parsedContent: IRichText = {value: {
            blocks: [],
            entityMap: {}
        }}

    get data(): IRichText {
        this.parse();
        return this._parsedContent
    }

    set data(value: IRichText) {
        this._parsedContent = value;
    }

    setValue(value: RawDraftContentState) {
        this._parsedContent.value = value;
    }

}

const RichText = ({item, t}: { item: IItem, t: TFunction<"translation", undefined> }) => {
    const richTextContent = new RichTextContent(EItemType.RichText, item.content);
    const contentRef: RefObject<HTMLDivElement | null> = React.createRef();
    useEffect(() => {
        if(contentRef.current){
            contentRef.current.innerHTML = draftToHtml(richTextContent.data.value)
        }
    }, []);
    return (
        <div className={`rich-text ${item.style}`}>
            <div ref={contentRef} />
        </div>
    )
}

export default RichText