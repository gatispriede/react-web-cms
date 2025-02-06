import {Input} from "antd";
import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {EItemType} from "../../../enums/EItemType";
import {PlainImageContent} from "../InputContent/PlainImage";

const InputPlainImage = ({setContent}:IInputContent) => {
    const plainImage = new PlainImageContent(EItemType.Image, '{}');
    return (
        <div>
            <label>Image URL:</label>
            <Input onChange={(e) => {
                plainImage.setSrc(e.target.value)
                setContent(plainImage.stringData)
            }}/>
        </div>
    )
}

export default InputPlainImage