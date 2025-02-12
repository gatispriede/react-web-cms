import React, {useState} from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {RichTextContent} from "../SectionComponents/RichText";
import {EItemType} from "../../../enums/EItemType";
import 'react-quill/dist/quill.snow.css';
import dynamic from 'next/dynamic'
const RichTextEditor = dynamic(
    () => import('../common/RichTextEditor'),
    { ssr: false }
)

const InputRichText = ({content,setContent}: IInputContent) => {
    const richTextContent = new RichTextContent(EItemType.RichText, content)
    return (
        <RichTextEditor value={richTextContent.data.value} setValue={(value: string) => {
            richTextContent.setValue(value)
            setContent(richTextContent.stringData)
        }} />
        // <ReactQuill theme="snow" value={value} onChange={(value: string) => {
        //     richTextContent.setValue(value)
        //     setValue(value)
        //     setContent(richTextContent.stringData)
        // }}/>
    )
}

export default InputRichText