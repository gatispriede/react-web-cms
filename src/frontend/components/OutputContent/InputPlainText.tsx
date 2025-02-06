import {Input} from "antd";
import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";

const InputPlainText = ({setContent}:IInputContent) => {
    return (
        <div className={'plain-text'}>
            <label>Please enter text: </label>
            <Input onChange={(e) => {
                setContent(e.target.value)
            }}/>
        </div>
    )
}

export default InputPlainText