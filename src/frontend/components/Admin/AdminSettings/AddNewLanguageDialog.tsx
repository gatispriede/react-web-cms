import {Divider, Form, Input, Modal, Tag, Typography} from "antd";
import React, {useState} from "react";
import {TFunction} from "i18next";
import TranslationManager from "../TranslationManager";
import {LANGUAGE_PRESETS, LanguagePreset} from "./languagePresets";

interface AddNewLanguageDialogProps {
    t: TFunction<"common", undefined>,
    open: boolean,
    close: (didSave: boolean) => void
}

const AddNewLanguageDialog = ({t, open, close}: AddNewLanguageDialogProps) => {
    const translationManage = new TranslationManager();
    const [form] = Form.useForm();
    const [presetFilter, setPresetFilter] = useState('');

    const onFinish = async (values: any) => {
        await translationManage.saveNewLanguage(values);
        form.resetFields();
        close(true);
    };

    const pickPreset = (p: LanguagePreset) => {
        form.setFieldsValue({symbol: p.symbol, label: p.label, flag: p.flag});
    };

    const filtered = presetFilter.trim()
        ? LANGUAGE_PRESETS.filter(p =>
            p.label.toLowerCase().includes(presetFilter.trim().toLowerCase()) ||
            p.symbol.includes(presetFilter.trim().toLowerCase()))
        : LANGUAGE_PRESETS;

    return (
        <Modal
            width={560}
            title={t('Add new language')}
            open={open}
            destroyOnClose
            onCancel={() => { form.resetFields(); close(false); }}
            onOk={() => form.submit()}
        >
            <Typography.Text type="secondary">
                {t('Pick a preset to prefill, or enter your own below.')}
            </Typography.Text>
            <Input.Search
                allowClear
                size="small"
                placeholder={t('Filter presets')}
                style={{marginTop: 8, marginBottom: 8}}
                value={presetFilter}
                onChange={e => setPresetFilter(e.target.value)}
            />
            <div style={{maxHeight: 160, overflowY: 'auto', marginBottom: 8}}>
                {filtered.map(p => (
                    <Tag.CheckableTag
                        key={p.symbol + '-' + p.label}
                        checked={false}
                        onChange={() => pickPreset(p)}
                        style={{marginBottom: 6, cursor: 'pointer', userSelect: 'none'}}
                    >
                        <span style={{marginRight: 6}}>{p.flag}</span>
                        {p.label}
                        <span style={{marginLeft: 6, opacity: 0.55}}>({p.symbol})</span>
                    </Tag.CheckableTag>
                ))}
            </div>
            <Divider style={{margin: '8px 0'}}/>
            <Form form={form} name="add-language" onFinish={onFinish} layout="vertical">
                <Form.Item
                    name="label"
                    label={t("Language name")}
                    rules={[{required: true, message: t('Please enter a language name')}]}
                >
                    <Input maxLength={40} placeholder="English"/>
                </Form.Item>
                <Form.Item
                    name="symbol"
                    label={t("Language symbol (2 characters)")}
                    rules={[
                        {
                            required: true,
                            max: 2,
                            pattern: /^[a-zA-Z]+$/i,
                            message: t('2 letters required (e.g. en)'),
                        },
                    ]}
                >
                    <Input showCount maxLength={2} placeholder="en"/>
                </Form.Item>
                <Form.Item
                    name="flag"
                    label={t("Flag (emoji or image URL)")}
                    tooltip={t("Shown next to the language name in the public menu dropdown.")}
                >
                    <Input maxLength={80} placeholder="🇬🇧"/>
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default AddNewLanguageDialog;
