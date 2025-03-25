import React from "react";
import InputPlainText from "../Admin/ConfigComponents/InputPlainText";
import InputRichText from "../Admin/ConfigComponents/InputRichText";
import InputPlainImage from "../Admin/ConfigComponents/InputPlainImage";
import InputGallery from "../Admin/ConfigComponents/InputGallery";
import EItemType from "../../../enums/EItemType";
import InputCarousel from "../Admin/ConfigComponents/InputCarousel";
import {TFunction} from "i18next";

export const ContentSection = ({selected, content, setContent, t}: {
    content: string,
    selected: string,
    setContent: (value: string) => void,
    t: TFunction<"translation", undefined>
}) => {
    switch (selected) {
        case EItemType.Text:
            return <InputPlainText t={t} content={content} setContent={setContent} />
        case EItemType.RichText:
            return <InputRichText t={t} content={content} setContent={setContent} />
        case EItemType.Image:
            return <InputPlainImage t={t} content={content} setContent={setContent} />
        case EItemType.Gallery:
            return <InputGallery t={t} content={content} setContent={setContent} />
        case EItemType.Carousel:
            return <InputCarousel t={t} content={content} setContent={setContent} />
        default:
            return <></>

    }
}