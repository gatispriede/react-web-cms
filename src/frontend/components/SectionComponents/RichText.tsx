import React, {RefObject, useEffect} from "react";
import ContentManager from "../ContentManager";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";

export interface IRichText {
    value: string;
}

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

const RichText = ({item}:{item: IItem}) => {
    const richTextContent = new RichTextContent(EItemType.RichText, item.content);
    const contentRef: RefObject<HTMLDivElement | null> = React.createRef();
    useEffect(() => {
        if(contentRef.current){
            contentRef.current.innerHTML = richTextContent.data.value
        }
    }, []);
    return (
        <div className={'rich-text'}>
            <div ref={contentRef} />
        </div>
    )
}

export default RichText