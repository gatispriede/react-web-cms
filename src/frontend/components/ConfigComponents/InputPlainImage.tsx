import {Input} from "antd";
import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {EItemType} from "../../../enums/EItemType";
import {PlainImageContent} from "../SectionComponents/PlainImage";
import dynamic from 'next/dynamic'
const RichTextEditor = dynamic(
    () => import('../common/RichTextEditor'),
    { ssr: false }
)

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
            <RichTextEditor value={plainImage.data.description} setValue={(value: string) => {
                plainImage.setDescription(value)
                setContent(plainImage.stringData)
            }} />
        </div>
    )
}

export default InputPlainImage