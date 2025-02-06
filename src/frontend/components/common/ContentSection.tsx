import React from "react";
import InputPlainText from "../ConfigComponents/InputPlainText";
import InputRichText from "../ConfigComponents/InputRichText";
import InputPlainImage from "../ConfigComponents/InputPlainImage";

export const ContentSection = ({selected, content, setContent}: { content: string, selected: string, setContent: (value: string) => void }) => {
    switch (selected) {
        case 'TEXT':
            return <InputPlainText content={content} setContent={setContent} />
        case 'RICH_TEXT':
            return <InputRichText content={content} setContent={setContent} />
        case 'IMAGE':
        case 'IMAGE_WITH_TEXT':
        case 'CAROUSEL':
            return <InputPlainImage content={content} setContent={setContent} />
        default:
            return <></>

    }
}