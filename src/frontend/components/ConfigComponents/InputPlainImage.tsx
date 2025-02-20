import {Input, Switch} from "antd";
import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {EItemType} from "../../../enums/EItemType";
import {PlainImageContent} from "../SectionComponents/PlainImage";
import dynamic from 'next/dynamic'
import {RawDraftContentState} from "draft-js";
import ImageUpload from "../ImageUpload";
import {PUBLIC_IMAGE_PATH} from "../../../constants/imgPath";

const RichTextEditor = dynamic(
    () => import('../common/RichTextEditor'),
    {ssr: false}
)

const InputPlainImage = ({content, setContent}: IInputContent) => {
    const plainImage = new PlainImageContent(EItemType.Image, content);
    const setFile = (file: File) => {
        plainImage.setSrc(PUBLIC_IMAGE_PATH + file.name)
        setContent(plainImage.stringData)
    }
    return (
        <div>
            <div className={'settings'}>
                <label>Use as background image</label>
                <Switch value={plainImage.data.useAsBackground} onChange={(checked) => {
                    plainImage.setUseAsBackground(checked)
                    setContent(plainImage.stringData)
                }}/>
            </div>
            <label>Image</label>
            <ImageUpload setFile={setFile}/>
            <Input disabled={true} value={plainImage.data.src} onChange={(e) => {
                plainImage.setSrc(e.target.value)
                setContent(plainImage.stringData)
            }}/>
            {!plainImage.data.useAsBackground &&
                <div>
                    <label>Description:</label>
                    <RichTextEditor value={plainImage.data.description} setValue={(value: RawDraftContentState) => {
                        plainImage.setDescription(value)
                        setContent(plainImage.stringData)
                    }}/>
                </div>
            }
        </div>
    )
}

export default InputPlainImage