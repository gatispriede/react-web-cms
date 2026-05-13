import React, {useEffect, useMemo} from "react";
import {Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag} from "antd";
import {DeleteOutlined, EditOutlined, PlusOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import {useSession} from "next-auth/react";
import {IUser, UserRole} from "@interfaces/IUser";
import {Grant, FeatureGrant, PageGrant, LocaleGrant} from "@interfaces/IPermission";
import {useViewModel} from "@client/lib/state/observable";
import EmptyState from "@admin/lib/EmptyState";
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
        // Q10 — fold the three multi-select arrays into vm.editing.grants
        // before save. The VM rebuilds the discriminated `Grant[]` union.
        vm.setGrants(
            values.grantFeatures ?? [],
            values.grantPages ?? [],
            values.grantLocales ?? [],
        );
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
                    <Button data-testid={`users-row-${user.id}-edit-button`} size="small" icon={<EditOutlined/>} onClick={() => vm.openEdit(user)}>{t('Edit')}</Button>
                    <Popconfirm
                        title={t('Remove user?')}
                        description={t('This cannot be undone.')}
                        okText={t('Remove')}
                        okButtonProps={{danger: true, loading: vm.removePending}}
                        cancelText={t('Cancel')}
                        disabled={user.email === currentEmail}
                        onConfirm={() => vm.remove(user)}
                    >
                        <Button
                            data-testid={`users-row-${user.id}-delete-button`}
                            size="small"
                            danger
                            icon={<DeleteOutlined/>}
                            disabled={user.email === currentEmail}
                            loading={vm.removePending}
                        >{t('Remove')}</Button>
                    </Popconfirm>
                </Space>
            )},
    ], [t, currentEmail, vm]);

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}}>
                <Button data-testid="users-create-button" type="primary" icon={<PlusOutlined/>} onClick={vm.openCreate}>{t('Add user')}</Button>
                <Button data-testid="users-refresh-button" onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
            </Space>
            {!vm.loading && vm.users.length === 0 ? (
                <EmptyState
                    testId="users-empty-state"
                    title={t('empty.users.title')}
                    description={t('empty.users.description')}
                    primary={{
                        label: t('empty.users.primary'),
                        onClick: vm.openCreate,
                        testId: 'users-empty-primary-btn',
                    }}
                />
            ) : (
                <Table
                    rowKey="id"
                    loading={vm.loading}
                    dataSource={vm.users}
                    columns={columns}
                    pagination={{pageSize: 10}}
                    size="middle"
                    onRow={(u: IUser) => ({'data-testid': `users-row-${u.id}`} as any)}
                />
            )}
            {vm.editing !== null && (
                <Modal
                    data-testid="users-editor-modal"
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
                            grantFeatures: ((vm.editing?.grants ?? []).filter(g => g.kind === 'feature') as FeatureGrant[]).map(g => g.feature),
                            grantPages: ((vm.editing?.grants ?? []).filter(g => g.kind === 'page') as PageGrant[]).map(g => g.page),
                            grantLocales: ((vm.editing?.grants ?? []).filter(g => g.kind === 'locale') as LocaleGrant[]).map(g => g.locale),
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
                            <Input data-testid="users-email-input" disabled={!!vm.editing?.id} autoComplete="off"/>
                        </Form.Item>
                        <Form.Item name="name" label={t('Name')}>
                            <Input data-testid="users-name-input" autoComplete="off"/>
                        </Form.Item>
                        <Form.Item name="role" label={t('Role')}>
                            <Select
                                data-testid="users-role-select"
                                options={ROLE_OPTIONS.map(r => ({value: r.value, label: t(r.label)}))}
                            />
                        </Form.Item>
                        <Form.Item
                            name="canPublishProduction"
                            label={t('Can publish to production')}
                            valuePropName="checked"
                            tooltip={t('Allows copying the draft site state into the live published snapshot.')}
                        >
                            <Switch data-testid="users-can-publish-switch"/>
                        </Form.Item>
                        <Form.Item
                            name="password"
                            label={vm.editing?.id ? t('New password (leave blank to keep)') : t('Password')}
                            rules={vm.editing?.id ? [] : [{required: true, message: t('Password is required')}]}
                        >
                            <Input.Password data-testid="users-password-input" autoComplete="new-password"/>
                        </Form.Item>
                        {/* Q10 — three-dimension grants: feature / page / locale.
                            Constrained multi-selects (not free-text tags) — options
                            come from the live registries (feature flags / pages /
                            languages) so admins pick from real values instead of
                            typing strings that don't match anything registered.
                            Per coding-principle (2026-05-03): predefined selections
                            beat free text wherever the value space is enumerable. */}
                        <Form.Item
                            name="grantFeatures"
                            label={t('Feature grants')}
                            tooltip={t('User can mutate these features (e.g. Posts, Themes).')}
                        >
                            <Select
                                data-testid="users-grant-features-select"
                                mode="multiple"
                                allowClear
                                placeholder={t('Pick features…')}
                                options={vm.featureOptions.map(id => ({label: id, value: id}))}
                                showSearch
                                optionFilterProp="label"
                            />
                        </Form.Item>
                        <Form.Item
                            name="grantPages"
                            label={t('Page grants')}
                            tooltip={t('Pages the user can edit.')}
                        >
                            <Select
                                data-testid="users-grant-pages-select"
                                mode="multiple"
                                allowClear
                                placeholder={t('Pick pages…')}
                                options={vm.pageOptions.map(p => ({label: p, value: p}))}
                                showSearch
                                optionFilterProp="label"
                            />
                        </Form.Item>
                        <Form.Item
                            name="grantLocales"
                            label={t('Locale grants')}
                            tooltip={t('Languages the user can edit / translate.')}
                        >
                            <Select
                                data-testid="users-grant-locales-select"
                                mode="multiple"
                                allowClear
                                placeholder={t('Pick locales…')}
                                options={vm.localeOptions.map(l => ({label: l, value: l}))}
                                showSearch
                                optionFilterProp="label"
                            />
                        </Form.Item>
                    </Form>
                </Modal>
            )}
        </div>
    );
};

export default AdminSettingsUsers;
