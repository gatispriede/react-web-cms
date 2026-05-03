import {Button, Input, Switch} from "antd";
import React, {useState} from "react";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {PlainImageContent} from "@client/modules/PlainImage";
import dynamic from 'next/dynamic'
import ImageRefInput from "@admin/lib/ImageRefInput";

const RichTextEditorWidget = dynamic(
    () => import('@client/lib/RichTextEditor'),
    {ssr: false}
) as React.ComponentType<{value: string; setValue: (value: string) => void}>;

export const PlainImageEditor = ({content, setContent, t}: IInputContent) => {
    const plainImage = new PlainImageContent(EItemType.Image, content);
    const data = plainImage.data;
    const hasAdvanced = !!(
        data.useAsBackground ||
        data.imageFixed ||
        data.useGradiant ||
        data.offsetX
    );
    const [showAdvanced, setShowAdvanced] = useState<boolean>(hasAdvanced);
    return (
        <div className={'admin-image'}>
            <label>{t("Image")}</label>
            <ImageRefInput
                t={t}
                value={data.image}
                onChange={(next) => {
                    plainImage.setImage(next);
                    setContent(plainImage.stringData);
                }}
                hideAlt={!data.useAsBackground}
            />
            <div style={{marginTop: 8, marginBottom: 8}}>
                <Button
                    type="link"
                    size="small"
                    style={{padding: 0}}
                    onClick={() => setShowAdvanced(v => !v)}
                    aria-expanded={showAdvanced}
                >
                    {showAdvanced ? t('Show less') : t('Show more')}
                </Button>
            </div>
            {showAdvanced && (
                <div className={'settings'}>
                    <label>{t("Use as background image")}</label>
                    <Switch value={data.useAsBackground} onChange={(checked) => {
                        plainImage.setUseAsBackground(checked)
                        setContent(plainImage.stringData)
                    }}/>
                    <label>{t("Make image fixed position")}</label>
                    <Switch value={data.imageFixed} onChange={(checked) => {
                        plainImage.setImageFixed(checked)
                        setContent(plainImage.stringData)
                    }}/>
                    <label>{t("Use gradiant")}</label>
                    <Switch value={data.useGradiant} onChange={(checked) => {
                        plainImage.setUseGradiant(checked)
                        setContent(plainImage.stringData)
                    }}/>
                    <label>{t("Image vertical offset")}</label>
                    <Input defaultValue={0} value={data.offsetX} onChange={(e) => {
                        plainImage.setOffsetX(parseInt(e.target.value))
                        setContent(plainImage.stringData)
                    }}/>
                </div>
            )}
            {!data.useAsBackground &&
                <div>
                    <label>{t("Description")}:</label>
                    <div className={'rich-text-container-admin'}>
                        <RichTextEditorWidget value={data.description} setValue={(value: string) => {
                            plainImage.setDescription(value)
                            setContent(plainImage.stringData)
                        }}/>
                    </div>
                </div>
            }
        </div>
    )
}

export default PlainImageEditor;
