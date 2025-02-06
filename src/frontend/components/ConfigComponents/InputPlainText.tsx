import {Input} from "antd";
import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {RichTextContent} from "../SectionComponents/RichText";
import {EItemType} from "../../../enums/EItemType";

const InputPlainText = ({content, setContent}:IInputContent) => {
    const richTextContent = new RichTextContent(EItemType.RichText, content)
    return (
        <div className={'plain-text'}>
            <label>Please enter text: </label>
            <Input value={richTextContent.data.value} onChange={(e) => {
                richTextContent.setValue(e.target.value)
                setContent(richTextContent.stringData)
            }}/>
        </div>
    )
}

export default InputPlainText