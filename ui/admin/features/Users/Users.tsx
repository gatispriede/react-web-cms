import React, {useEffect, useMemo} from "react";
import {Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag} from "antd";
import {DeleteOutlined, EditOutlined, PlusOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import {useSession} from "next-auth/react";
import {IUser, UserRole} from "@interfaces/IUser";
import {useViewModel} from "@client/lib/state/observable";
import {UsersViewModel} from "./UsersViewModel";

/** Render-only Users pane — VM3 (2026-05-02). */

const ROLE_OPTIONS: {value: UserRole; label: string; color: string}[] = [
    {value: 'viewer', label: 'Viewer', color: 'default'},
    {value: 'editor', label: 'Editor', color: 'blue'},
    {value: 'admin', label: 'Admin', color: 'volcano'},
];

const AdminSettingsUsers = () => {
    const {t} = useTranslation();
    const {data: session, update: updateSession} = useSession();
    const currentEmail = session?.user?.email ?? '';
    const vm = useViewModel(() => new UsersViewModel(undefined, t));
    const [form] = Form.useForm();

    useEffect(() => { void vm.refresh(); }, [vm]);

    const onSave = async () => {
        const values = await form.validateFields();
        await vm.save(values, currentEmail, async () => {
            await updateSession({user: {mustChangePassword: false}});
        });
        form.resetFields();
    };

    const onClose = () => {
        vm.close();
        form.resetFields();
    };

    const columns = useMemo(() => [
        {title: t('Email'), dataIndex: 'email', key: 'email',
            render: (email: string) => (
                <span>
                    {email}
                    {email === currentEmail ? <Tag style={{marginLeft: 8}} color="green">{t('you')}</Tag> : null}
                </span>
            )},
        {title: t('Name'), dataIndex: 'name', key: 'name'},
        {title: t('Role'), dataIndex: 'role', key: 'role',
            render: (role: UserRole = 'viewer') => {
                const r = ROLE_OPTIONS.find(o => o.value === role) ?? ROLE_OPTIONS[0];
                return <Tag color={r.color}>{t(r.label)}</Tag>;
            }},
        {title: t('Can publish'), dataIndex: 'canPublishProduction', key: 'canPublishProduction', width: 130,
            render: (canPublish: boolean) =>
                canPublish ? <Tag color="green">{t('Yes')}</Tag> : <Tag>{t('No')}</Tag>},
        {title: t('Actions'), key: 'actions', width: 180,
            render: (_: unknown, user: IUser) => (
                <Space>
                    <Button size="small" icon={<EditOutlined/>} onClick={() => vm.openEdit(user)}>{t('Edit')}</Button>
                    <Popconfirm
                        title={t('Remove user?')}
                        description={t('This cannot be undone.')}
                        okText={t('Remove')}
                        okButtonProps={{danger: true}}
                        cancelText={t('Cancel')}
                        disabled={user.email === currentEmail}
                        onConfirm={() => vm.remove(user)}
                    >
                        <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined/>}
                            disabled={user.email === currentEmail}
                        >{t('Remove')}</Button>
                    </Popconfirm>
                </Space>
            )},
    ], [t, currentEmail, vm]);

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}}>
                <Button type="primary" icon={<PlusOutlined/>} onClick={vm.openCreate}>{t('Add user')}</Button>
                <Button onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
            </Space>
            <Table
                rowKey="id"
                loading={vm.loading}
                dataSource={vm.users}
                columns={columns}
                pagination={{pageSize: 10}}
                size="middle"
            />
            {vm.editing !== null && (
                <Modal
                    title={vm.editing?.id ? t('Edit user') : t('Add user')}
                    open
                    onCancel={onClose}
                    onOk={onSave}
                    confirmLoading={vm.saving}
                    okText={vm.editing?.id ? t('Save') : t('Create')}
                    destroyOnClose
                >
                    <Form
                        form={form}
                        layout="vertical"
                        preserve={false}
                        key={vm.editing?.id ?? 'new'}
                        initialValues={{
                            email: vm.editing?.email ?? '',
                            name: vm.editing?.name ?? '',
                            role: vm.editing?.role ?? 'viewer',
                            canPublishProduction: Boolean(vm.editing?.canPublishProduction),
                        }}
                    >
                        <Form.Item
                            name="email"
                            label={t('Email')}
                            rules={[
                                {required: true, message: t('Email is required')},
                                {type: 'email', message: t('Enter a valid email')},
                            ]}
                        >
                            <Input disabled={!!vm.editing?.id} autoComplete="off"/>
                        </Form.Item>
                        <Form.Item name="name" label={t('Name')}>
                            <Input autoComplete="off"/>
                        </Form.Item>
                        <Form.Item name="role" label={t('Role')}>
                            <Select
                                options={ROLE_OPTIONS.map(r => ({value: r.value, label: t(r.label)}))}
                            />
                        </Form.Item>
                        <Form.Item
                            name="canPublishProduction"
                            label={t('Can publish to production')}
                            valuePropName="checked"
                            tooltip={t('Allows copying the draft site state into the live published snapshot.')}
                        >
                            <Switch/>
                        </Form.Item>
                        <Form.Item
                            name="password"
                            label={vm.editing?.id ? t('New password (leave blank to keep)') : t('Password')}
                            rules={vm.editing?.id ? [] : [{required: true, message: t('Password is required')}]}
                        >
                            <Input.Password autoComplete="new-password"/>
                        </Form.Item>
                    </Form>
                </Modal>
            )}
        </div>
    );
};

export default AdminSettingsUsers;
