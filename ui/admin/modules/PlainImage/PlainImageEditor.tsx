import {Input, Switch} from "antd";
import React from "react";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {PlainImageContent} from "@client/modules/PlainImage";
import dynamic from 'next/dynamic'
import ImageUpload from "@admin/lib/ImageUpload";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import ImageDropTarget from "@client/lib/ImageDropTarget";

const RichTextEditorWidget = dynamic(
    () => import('@client/lib/RichTextEditor'),
    {ssr: false}
) as React.ComponentType<{value: string; setValue: (value: string) => void}>;

export const PlainImageEditor = ({content, setContent, t}: IInputContent) => {
    const plainImage = new PlainImageContent(EItemType.Image, content);
    const setFile = (file: File) => {
        plainImage.setSrc(PUBLIC_IMAGE_PATH + file.name)
        setContent(plainImage.stringData)
    }
    return (
        <ImageDropTarget
            className={'admin-image'}
            filled={!!plainImage.data.src}
            onImage={(img) => {
                plainImage.setSrc(PUBLIC_IMAGE_PATH + img.name);
                setContent(plainImage.stringData);
            }}
        >
            <div className={'settings'}>
                <label>{t("Use as background image")}</label>
                <Switch value={plainImage.data.useAsBackground} onChange={(checked) => {
                    plainImage.setUseAsBackground(checked)
                    setContent(plainImage.stringData)
                }}/>
                <label>{t("Make image fixed position")}</label>
                <Switch value={plainImage.data.imageFixed} onChange={(checked) => {
                    plainImage.setImageFixed(checked)
                    setContent(plainImage.stringData)
                }}/>
                <label>{t("Use gradiant")}</label>
                <Switch value={plainImage.data.useGradiant} onChange={(checked) => {
                    plainImage.setUseGradiant(checked)
                    setContent(plainImage.stringData)
                }}/>

                <label>{t("Image vertical offset")}</label>
                <Input defaultValue={0} value={plainImage.data.offsetX} onChange={(e) => {
                    plainImage.setOffsetX(parseInt(e.target.value))
                    setContent(plainImage.stringData)
                }}/>
                <label>{t("Image width")}</label>
                <Input defaultValue={0} value={plainImage.data.imgWidth} onChange={(e) => {
                    plainImage.setImgWidth((e.target.value))
                    setContent(plainImage.stringData)
                }}/>
                <label>{t("Image height")}</label>
                <Input defaultValue={0} value={plainImage.data.imgHeight} onChange={(e) => {
                    plainImage.setImgHeight((e.target.value))
                    setContent(plainImage.stringData)
                }}/>
            </div>
            <label>{t("Image")}</label>
            <ImageUpload t={t} setFile={setFile}/>
            <Input disabled={true} value={plainImage.data.src} onChange={(e) => {
                plainImage.setSrc(e.target.value)
                setContent(plainImage.stringData)
            }}/>
            {!plainImage.data.useAsBackground &&
                <div>
                    <label>{t("Description")}:</label>
                    <div className={'rich-text-container-admin'}>
                        <RichTextEditorWidget value={plainImage.data.description} setValue={(value: string) => {
                            plainImage.setDescription(value)
                            setContent(plainImage.stringData)
                        }}/>
                    </div>

                </div>
            }
        </ImageDropTarget>
    )
}

export default PlainImageEditor;
