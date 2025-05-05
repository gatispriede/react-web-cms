import React, {useEffect, useState} from "react";
import {IInputContent} from "../../../../Interfaces/IInputContent";
import {RichTextContent} from "../../SectionComponents/RichText";
import {EItemType} from "../../../../enums/EItemType";
import dynamic from 'next/dynamic'

const RichTextEditor = dynamic(
    () => import('../../common/RichTextEditor'),
    {ssr: false}
)

const InputRichText = ({content, setContent}: IInputContent) => {
    const richTextContent = new RichTextContent(EItemType.RichText, content)
    const [val, setVal] = useState(false)
    useEffect(() => {
        if(typeof window !== 'undefined') setVal(true)
    }, []);
    return (
        <div className={'rich-text-container-admin'}>
            {val &&
                <RichTextEditor
                    value={richTextContent.data.value}
                    setValue={(value: string) => {
                        richTextContent.setValue(value)
                        setContent(richTextContent.stringData)
                    }}
                />
            }
        </div>

    )
}

export default InputRichText