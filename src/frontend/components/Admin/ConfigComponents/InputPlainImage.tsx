import {Input, Switch} from "antd";
import React from "react";
import {IInputContent} from "../../../../Interfaces/IInputContent";
import {EItemType} from "../../../../enums/EItemType";
import {PlainImageContent} from "../../SectionComponents/PlainImage";
import dynamic from 'next/dynamic'
import {RawDraftContentState} from "draft-js";
import ImageUpload from "../../ImageUpload";
import {PUBLIC_IMAGE_PATH} from "../../../../constants/imgPath";

const RichTextEditor = dynamic(
    () => import('../../common/RichTextEditor'),
    {ssr: false}
)

const InputPlainImage = ({content, setContent, t}: IInputContent) => {
    const plainImage = new PlainImageContent(EItemType.Image, content);
    const setFile = (file: File) => {
        plainImage.setSrc(PUBLIC_IMAGE_PATH + file.name)
        setContent(plainImage.stringData)
    }
    return (
        <div className={'admin-image'}>
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
                        <RichTextEditor value={plainImage.data.description} setValue={(value: RawDraftContentState) => {
                            plainImage.setDescription(value)
                            setContent(plainImage.stringData)
                        }}/>
                    </div>

                </div>
            }
        </div>
    )
}

export default InputPlainImage