import React, {useEffect, useState} from "react";
import {IInputContent} from "@interfaces/IInputContent";
import {RichTextContent} from "@client/modules/RichText";
import {EItemType} from "@enums/EItemType";
import dynamic from 'next/dynamic'

// Dynamic import keeps the heavy rich-text editor bundle out of the SSR payload.
// Aliased name avoids colliding with this module's own `RichTextEditor` symbol.
const RichTextEditorWidget = dynamic(
    () => import('@client/lib/RichTextEditor'),
    {ssr: false}
) as React.ComponentType<{value: string; setValue: (value: string) => void}>;

const RichTextEditor = ({content, setContent}: IInputContent) => {
    const richTextContent = new RichTextContent(EItemType.RichText, content)
    const [val, setVal] = useState(false)
    useEffect(() => {
        if(typeof window !== 'undefined') setVal(true)
    }, []);
    return (
        <div className={'rich-text-container-admin'}>
            {/* DECISION: CKEditor's contenteditable doesn't accept `data-testid`
                directly. Expose a hidden textarea with the canonical testid so
                Playwright's `.fill()` can write the marker text and the same
                setContent path runs. */}
            <textarea
                data-testid="module-editor-primary-text-input"
                style={{position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none'}}
                value={richTextContent.data.value}
                onChange={(e) => {
                    richTextContent.setValue(e.target.value)
                    setContent(richTextContent.stringData)
                }}
            />
            {val &&
                <RichTextEditorWidget
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

export {RichTextEditor};
export default RichTextEditor;
