import React from "react";
import InputPlainText from "../ConfigComponents/InputPlainText";
import InputRichText from "../ConfigComponents/InputRichText";
import InputPlainImage from "../ConfigComponents/InputPlainImage";
import InputGallery from "../ConfigComponents/InputGallery";

export const ContentSection = ({selected, content, setContent}: { content: string, selected: string, setContent: (value: string) => void }) => {
    switch (selected) {
        case 'TEXT':
            return <InputPlainText content={content} setContent={setContent} />
        case 'RICH_TEXT':
            return <InputRichText content={content} setContent={setContent} />
        case 'IMAGE':
            return <InputPlainImage content={content} setContent={setContent} />
        case 'GALLERY':
            return <InputGallery content={content} setContent={setContent} />
        case 'CAROUSEL':
            return <InputPlainImage content={content} setContent={setContent} />
        default:
            return <></>

    }
}