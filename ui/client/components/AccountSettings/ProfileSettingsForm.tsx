import React, {useState} from 'react';
import {Alert, Button, Form, Input, Radio, Select, Modal} from 'antd';
import {toast} from 'sonner';
import type {IUser} from '@interfaces/IUser';
import {mcpCall} from './mcpClient';

/**
 * Profile tab — dispatches between client + company sub-forms via the
 * `<TypeSwitcher>` radio. Type-switch confirmation modal fires
 * client→company (no-op) and company→client (with archive warning).
 *
 * Submit routes through `accountSettings.update` so the MCP tool
 * surface is the single source of truth.
 */
const LEGAL_ENTITY_OPTIONS = [
    {value: 'sole-prop', label: 'Sole proprietor'},
    {value: 'llc', label: 'LLC'},
    {value: 'plc', label: 'PLC'},
    {value: 'gmbh', label: 'GmbH'},
    {value: 'sa', label: 'SA'},
    {value: 'inc', label: 'Inc'},
    {value: 'other', label: 'Other'},
];

export const ProfileClientForm: React.FC<{me: IUser; onSaved: () => void}> = ({me, onSaved}) => {
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);
    const onFinish = async (values: {name?: string; dateOfBirth?: string; phone?: string}) => {
        setSaving(true);
        try {
            await mcpCall('accountSettings.update', {userId: me.id, patch: values});
            toast.success('Profile saved');
            onSaved();
        } catch (e) {
            toast.error(`Save failed: ${(e as Error).message}`);
        } finally {
            setSaving(false);
        }
    };
    return (
        <Form form={form} layout="vertical" initialValues={me} onFinish={onFinish} data-testid="profile-client-form">
            <Form.Item label="Name" name="name" rules={[{required: true}]}>
                <Input data-testid="profile-client-name-input"/>
            </Form.Item>
            <Form.Item label="Phone" name="phone">
                <Input data-testid="profile-client-phone-input"/>
            </Form.Item>
            <Form.Item label="Date of birth" name="dateOfBirth">
                <Input type="date" data-testid="profile-client-dob-input"/>
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} data-testid="profile-client-save-btn">Save</Button>
        </Form>
    );
};

export const ProfileCompanyForm: React.FC<{me: IUser; onSaved: () => void}> = ({me, onSaved}) => {
    const [form] = Form.useForm();
    const [saving, setSaving] = useState(false);
    const [viesPending, setViesPending] = useState(false);
    const [viesResult, setViesResult] = useState<boolean | null | undefined>(me.company?.viesVerified);

    const onFinish = async (values: {company?: Record<string, unknown>}) => {
        setSaving(true);
        try {
            await mcpCall('accountSettings.update', {userId: me.id, patch: {company: values.company}});
            toast.success('Company profile saved');
            onSaved();
        } catch (e) {
            toast.error(`Save failed: ${(e as Error).message}`);
        } finally {
            setSaving(false);
        }
    };

    const verifyVat = async () => {
        setViesPending(true);
        try {
            const out = await mcpCall<{viesVerified: boolean | null}>('customer.company.viesRefresh', {userId: me.id});
            setViesResult(out.viesVerified);
            toast.success(out.viesVerified === true ? 'VAT verified' : out.viesVerified === false ? 'VAT failed verification' : 'VIES unreachable — pending');
        } catch (e) {
            toast.error(`Verify failed: ${(e as Error).message}`);
        } finally {
            setViesPending(false);
        }
    };

    return (
        <Form form={form} layout="vertical" initialValues={{company: me.company}} onFinish={onFinish} data-testid="profile-company-form">
            <Form.Item label="Legal name" name={['company', 'legalName']} rules={[{required: true}]}>
                <Input data-testid="profile-company-legalname-input"/>
            </Form.Item>
            <Form.Item label="Legal entity type" name={['company', 'legalEntityType']} rules={[{required: true}]}>
                <Select options={LEGAL_ENTITY_OPTIONS} data-testid="profile-company-entitytype-select"/>
            </Form.Item>
            <Form.Item label="Registration number" name={['company', 'registrationNumber']} rules={[{required: true}]}>
                <Input data-testid="profile-company-regno-input"/>
            </Form.Item>
            <Form.Item label="VAT ID" name={['company', 'vatId']}>
                <Input
                    data-testid="profile-company-vat-input"
                    addonAfter={
                        <Button size="small" loading={viesPending} onClick={verifyVat} data-testid="profile-company-vies-btn">Verify (VIES)</Button>
                    }
                />
            </Form.Item>
            {viesResult === true && <Alert type="success" message="VIES verified" data-testid="profile-company-vies-ok"/>}
            {viesResult === false && <Alert type="error" message="VIES rejected" data-testid="profile-company-vies-bad"/>}
            {viesResult === null && <Alert type="warning" message="VIES unreachable — pending" data-testid="profile-company-vies-pending"/>}
            <Form.Item label="Contact person — first name" name={['company', 'contactPerson', 'firstName']}>
                <Input data-testid="profile-company-contact-first-input"/>
            </Form.Item>
            <Form.Item label="Contact person — last name" name={['company', 'contactPerson', 'lastName']}>
                <Input data-testid="profile-company-contact-last-input"/>
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} data-testid="profile-company-save-btn">Save</Button>
        </Form>
    );
};

export const TypeSwitcher: React.FC<{me: IUser; onSwitched: () => void}> = ({me, onSwitched}) => {
    const current: 'client' | 'company' = me.customerType ?? 'client';
    const [busy, setBusy] = useState(false);
    const onChange = async (next: 'client' | 'company') => {
        if (next === current) return;
        if (current === 'company' && next === 'client') {
            Modal.confirm({
                title: 'Switch to individual account?',
                content: 'This will hide your company information. Your business addresses will be archived. Continue?',
                okButtonProps: {'data-testid': 'type-switch-confirm-btn'} as never,
                onOk: () => doSwitch(next, true),
            });
            return;
        }
        await doSwitch(next, false);
    };
    const doSwitch = async (next: 'client' | 'company', ack: boolean) => {
        setBusy(true);
        try {
            await mcpCall('customer.type.set', {userId: me.id, type: next, ack});
            toast.success(`Switched to ${next}`);
            onSwitched();
        } catch (e) {
            toast.error(`Switch failed: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    };
    return (
        <Radio.Group value={current} disabled={busy} onChange={e => void onChange(e.target.value)} data-testid="account-type-switcher">
            <Radio value="client" data-testid="account-type-client">I am an individual</Radio>
            <Radio value="company" data-testid="account-type-company">I am buying for a business</Radio>
        </Radio.Group>
    );
};

export const ProfileSettingsForm: React.FC<{me: IUser; onMutated: () => void}> = ({me, onMutated}) => {
    const type: 'client' | 'company' = me.customerType ?? 'client';
    return (
        <div data-testid="profile-settings-form">
            <TypeSwitcher me={me} onSwitched={onMutated}/>
            <div style={{marginTop: 16}}>
                {type === 'company' ? <ProfileCompanyForm me={me} onSaved={onMutated}/> : <ProfileClientForm me={me} onSaved={onMutated}/>}
            </div>
        </div>
    );
};

export default ProfileSettingsForm;
