import React from "react";
import InputPlainText from "../ConfigComponents/InputPlainText";
import InputRichText from "../ConfigComponents/InputRichText";
import InputPlainImage from "../ConfigComponents/InputPlainImage";
import InputGallery from "../ConfigComponents/InputGallery";
import EItemType from "../../../enums/EItemType";
import InputCarousel from "../ConfigComponents/InputCarousel";

export const ContentSection = ({selected, content, setContent}: { content: string, selected: string, setContent: (value: string) => void }) => {
    switch (selected) {
        case EItemType.Text:
            return <InputPlainText content={content} setContent={setContent} />
        case EItemType.RichText:
            return <InputRichText content={content} setContent={setContent} />
        case EItemType.Image:
            return <InputPlainImage content={content} setContent={setContent} />
        case EItemType.Gallery:
            return <InputGallery content={content} setContent={setContent} />
        case EItemType.Carousel:
            return <InputCarousel content={content} setContent={setContent} />
        default:
            return <></>

    }
}