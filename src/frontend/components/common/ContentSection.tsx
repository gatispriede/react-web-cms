import React from "react";
import InputPlainText from "../OutputContent/InputPlainText";
import InputRichText from "../OutputContent/InputRichText";
import InputPlainImage from "../OutputContent/InputPlainImage";

export const ContentSection = ({selected, setContent}: { selected: string, setContent: (value: string) => void }) => {
    switch (selected) {
        case 'TEXT':
            return <InputPlainText setContent={setContent} />
        case 'RICH_TEXT':
            return <InputRichText setContent={setContent} />
        case 'IMAGE':
        case 'IMAGE_WITH_TEXT':
        case 'CAROUSEL':
            return <InputPlainImage setContent={setContent} />
        default:
            return <></>

    }
}