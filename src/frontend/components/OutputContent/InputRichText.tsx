import React, {useState} from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {RichTextContent} from "../InputContent/RichText";
import {EItemType} from "../../../enums/EItemType";
import 'react-quill/dist/quill.snow.css';
import dynamic from 'next/dynamic'
const ReactQuill = dynamic(() => import('react-quill-new'), {
    ssr: false
})

const InputRichText = ({setContent}: IInputContent) => {
    const richTextContent = new RichTextContent(EItemType.RichText, '{}')
    const [value,setValue] = useState('')
    return (
        <ReactQuill theme="snow" value={value} onChange={(value: string) => {
            richTextContent.setValue(value)
            setValue(value)
            setContent(richTextContent.stringData)
        }}/>
    )
}

export default InputRichText