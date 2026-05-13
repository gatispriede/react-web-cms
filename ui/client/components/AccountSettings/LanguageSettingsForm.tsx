import React, {useState} from 'react';
import {Button, Form, Select} from 'antd';
import {toast} from 'sonner';
import type {IUser} from '@interfaces/IUser';
import {mcpCall} from './mcpClient';

/**
 * Language tab — preferred site language + preferred email language.
 * Both are predefined enums (locale codes) — banned free text.
 */
const LANG_OPTIONS = [
    {value: 'en', label: 'English'},
    {value: 'lv', label: 'Latviešu'},
];

export const LanguageSettingsForm: React.FC<{me: IUser; onMutated: () => void}> = ({me, onMutated}) => {
    const [saving, setSaving] = useState(false);
    const onFinish = async (values: {preferredLanguage?: string}) => {
        setSaving(true);
        try {
            await mcpCall('accountSettings.update', {userId: me.id, patch: values});
            toast.success('Language saved');
            onMutated();
        } catch (e) {
            toast.error(`Save failed: ${(e as Error).message}`);
        } finally {
            setSaving(false);
        }
    };
    return (
        <Form layout="vertical" initialValues={me} onFinish={onFinish} data-testid="language-settings-form">
            <Form.Item label="Preferred site language" name="preferredLanguage">
                <Select options={LANG_OPTIONS} data-testid="language-site-select"/>
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} data-testid="language-save-btn">Save</Button>
        </Form>
    );
};

export default LanguageSettingsForm;
