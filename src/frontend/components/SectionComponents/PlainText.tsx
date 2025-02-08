import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {RichTextContent} from "./RichText";
import {IItem} from "../../../Interfaces/IItem";

const PlainText = ({item}:{item: IItem}) => {
    const richTextContent = new RichTextContent(EItemType.Text, item.content);
    return (
        <div className={'plain-text'}>
            {richTextContent.data.value}
        </div>
    )
}

export default PlainText