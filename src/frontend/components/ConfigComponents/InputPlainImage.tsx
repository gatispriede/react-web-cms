import {Input} from "antd";
import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {EItemType} from "../../../enums/EItemType";
import {PlainImageContent} from "../SectionComponents/PlainImage";
import RichTextEditor from "../common/RichTextEditor";

const InputPlainImage = ({content, setContent}:IInputContent) => {
    const plainImage = new PlainImageContent(EItemType.Image, content);
    return (
        <div>
            <label>Image URL:</label>
            <Input value={plainImage.data.src} onChange={(e) => {
                plainImage.setSrc(e.target.value)
                setContent(plainImage.stringData)
            }}/>
            <label>Description:</label>
            <Input value={plainImage.data.description} onChange={(e) => {
                plainImage.setDescription(e.target.value)
                setContent(plainImage.stringData)
            }}/>
            <RichTextEditor />
        </div>
    )
}

export default InputPlainImage