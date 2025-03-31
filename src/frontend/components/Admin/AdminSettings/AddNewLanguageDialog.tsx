import {Form, Input, Modal} from "antd";
import React from "react";
import {TFunction} from "i18next";
import TranslationManager from "../TranslationManager";

interface AddNewLanguageDialogProps {
    t: TFunction<"common", undefined>,
    open: boolean,
    close: () => void
}

const AddNewLanguageDialog = ({t, open, close}: AddNewLanguageDialogProps) => {
    const translationManage = new TranslationManager();
    const [form] = Form.useForm();
    const onFinish = async (values: any) => {
        await translationManage.saveNewLanguage(values)
        close()
    }

    return (
        <div>
            <Modal
                width={'500px'}
                title={t('Add new language')}
                open={open}
                onCancel={async () => {
                    close()
                }}
                onOk={async () => {
                    form.submit()
                }}
            >
                <div>
                    <Form
                        onFinish={onFinish}
                        form={form}
                        name="dynamic_rule"
                    >
                        <Form.Item
                            name="label"
                            label={t("Language name")}
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter a language name"
                                }
                            ]}
                        >
                            <Input maxLength={20} placeholder="English" />
                        </Form.Item>
                        <Form.Item
                            name="symbol"
                            label={t("Language symbol ( 2 characters )")}
                            rules={[
                                {
                                    required: true,
                                    max: 2,
                                    pattern: new RegExp(
                                        /^[a-zA-Z]+$/i
                                    ),
                                    message: "Please provide 2 symbols (Example: en)"
                                }
                            ]}
                        >
                            <Input showCount maxLength={2} placeholder="en"/>
                        </Form.Item>
                    </Form>
                </div>
            </Modal>
        </div>
    )
}
export default AddNewLanguageDialog