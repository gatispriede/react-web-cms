import {Input} from "antd";
import React from "react";
import {IInputContent} from "../../../../Interfaces/IInputContent";
import {EItemType} from "../../../../enums/EItemType";
import {PlainTextContent} from "../../SectionComponents/PlainText";

const InputPlainText = ({content, setContent, t}:IInputContent) => {
    const richTextContent = new PlainTextContent(EItemType.Text, content)
    return (
        <div className={'plain-text'}>
            <label>{t("Please enter text")}: </label>
            <Input value={richTextContent.data.value} onChange={(e) => {
                richTextContent.setValue(e.target.value)
                setContent(richTextContent.stringData)
            }}/>
        </div>
    )
}

export default InputPlainText