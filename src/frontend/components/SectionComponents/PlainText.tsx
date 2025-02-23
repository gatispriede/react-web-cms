import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {IRichText, RichTextContent} from "./RichText";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import {RawDraftContentState} from "draft-js";

export interface IPlainTextContent {
    value: string;
}

export enum EPlainTextStyle {
    Default = "default",
    Centered = "centered",
    CenteredBoxed = "centeredBoxed"
}

export class PlainTextContent extends ContentManager {
    public _parsedContent: IPlainTextContent = {value: ''}

    get data(): IPlainTextContent {
        this.parse();
        return this._parsedContent
    }

    set data(value: IPlainTextContent) {
        this._parsedContent = value;
    }

    setValue(value: string) {
        this._parsedContent.value = value;
    }

}

const PlainText = ({item}:{item: IItem}) => {
    const plainTextContent = new PlainTextContent(EItemType.Text, item.content);
    return (
        <div className={`plain-text ${item.style}`}>
            <p>{plainTextContent.data.value}</p>
        </div>
    )
}

export default PlainText