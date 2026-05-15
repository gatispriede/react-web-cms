import React from "react";
import {EItemType} from "@enums/EItemType";
import {IItem} from "@interfaces/IItem";
import ContentManager from "@client/lib/ContentManager";
import {TFunction} from "i18next";
import {InlineTranslatable} from "@client/lib/InlineTranslatable";
import {inlineEditAttr} from "@client/lib/inlineEditAttr";
import type {IPlainTextContent} from "./PlainText.types";
export type {IPlainTextContent} from "./PlainText.types";
export {EPlainTextStyle} from "./PlainText.types";

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

const PlainText = ({item, t, tApp, admin}: {
    item: IItem,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>,
    admin?: boolean,
}) => {
    const plainTextContent = new PlainTextContent(EItemType.Text, item.content);
    const editId = item.name || EItemType.Text;
    return (
        <div className={`plain-text ${item.style}`}>
            <p {...inlineEditAttr(admin, editId, 'value')}><InlineTranslatable tApp={tApp as any} source={plainTextContent.data.value}/></p>
        </div>
    )
}

export default PlainText