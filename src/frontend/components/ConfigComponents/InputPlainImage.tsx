import {Input} from "antd";
import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {EItemType} from "../../../enums/EItemType";
import {PlainImageContent} from "../SectionComponents/PlainImage";

const InputPlainImage = ({content, setContent}:IInputContent) => {
    const plainImage = new PlainImageContent(EItemType.Image, content);
    return (
        <div>
            <label>Image URL:</label>
            <Input value={plainImage.data.src} onChange={(e) => {
                plainImage.setSrc(e.target.value)
                setContent(plainImage.stringData)
            }}/>
        </div>
    )
}

export default InputPlainImage