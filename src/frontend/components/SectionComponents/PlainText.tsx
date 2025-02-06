import React from "react";
import {EItemType} from "../../../enums/EItemType";
import {RichTextContent} from "./RichText";


const PlainText = ({content}:{content: string}) => {
    const richTextContent = new RichTextContent(EItemType.RichText, content);
    return (
        <div className={'plain-text'}>
            {richTextContent.data.value}
        </div>
    )
}

export default PlainText