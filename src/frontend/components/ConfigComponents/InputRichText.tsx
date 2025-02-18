import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {RichTextContent} from "../SectionComponents/RichText";
import {EItemType} from "../../../enums/EItemType";
import dynamic from 'next/dynamic'
import {RawDraftContentState} from "draft-js";
const RichTextEditor = dynamic(
    () => import('../common/RichTextEditor'),
    { ssr: false }
)

const InputRichText = ({content,setContent}: IInputContent) => {
    const richTextContent = new RichTextContent(EItemType.RichText, content)
    return (
        <RichTextEditor value={richTextContent.data.value} setValue={(value: RawDraftContentState) => {
            richTextContent.setValue(value)
            setContent(richTextContent.stringData)
        }} />
    )
}

export default InputRichText