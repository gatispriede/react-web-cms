import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Button, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag, message} from "antd";
import {DeleteOutlined, EditOutlined, PlusOutlined} from "../../common/icons";
import {useTranslation} from "react-i18next";
import {useSession} from "next-auth/react";
import UserApi from "../../../api/UserApi";
import {IUser, InUser, UserRole} from "../../../../Interfaces/IUser";

const ROLE_OPTIONS: {value: UserRole; label: string; color: string}[] = [
    {value: 'viewer', label: 'Viewer', color: 'default'},
    {value: 'editor', label: 'Editor', color: 'blue'},
    {value: 'admin', label: 'Admin', color: 'volcano'},
];

const userApi = new UserApi();

const AdminSettingsUsers = () => {
    const {t} = useTranslation();
    const {data: session} = useSession();
    const currentEmail = session?.user?.email ?? '';

    const [users, setUsers] = useState<IUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Partial<InUser> | null>(null);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            setUsers(await userApi.listUsers());
        } catch (err) {
            message.error(String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const openCreate = () => {
        setEditing({role: 'viewer', canPublishProduction: false});
    };

    const openEdit = (user: IUser) => {
        setEditing({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            canPublishProduction: user.canPublishProduction,
        });
    };

    // Modal is `preserve={false}`, which unmounts the inner Form when
    // closed — so calling `form.setFieldsValue(...)` inside the open*
    // handlers above used to no-op on the **first** open of an edit
    // session (form not yet mounted), then succeed on the second open
    // because the previously-mounted instance was still around. Effect
    // runs after the Form is in the tree, so the values land every time.
    useEffect(() => {
        if (editing === null) return;
        form.resetFields();
        if (editing.id) {
            form.setFieldsValue({
                email: editing.email ?? '',
                name: editing.name ?? '',
                role: editing.role ?? 'viewer',
                canPublishProduction: Boolean(editing.canPublishProduction),
            });
        } else {
            form.setFieldsValue({role: 'viewer', canPublishProduction: false});
        }
    }, [editing, form]);

    const close = () => {
        setEditing(null);
        form.resetFields();
    };

    const save = async () => {
        const values = await form.validateFields();
        setSaving(true);
        try {
            const payload: InUser = {
                id: editing?.id,
                email: values.email,
                name: values.name,
                role: values.role,
                password: values.password || undefined,
                canPublishProduction: Boolean(values.canPublishProduction),
            };
            const result = editing?.id
                ? await userApi.updateUser(payload)
                : await userApi.addUser(payload);
            if (result.error) {
                message.error(result.error);
                return;
            }
            message.success(editing?.id ? t('User updated') : t('User created'));
            close();
            await refresh();
        } finally {
            setSaving(false);
        }
    };

    const remove = async (user: IUser) => {
        const result = await userApi.removeUser(user.id);
        if (result.error) {
            message.error(result.error);
            return;
        }
        message.success(t('User removed'));
        await refresh();
    };

    const columns = useMemo(() => [
        {
            title: t('Email'),
            dataIndex: 'email',
            key: 'email',
            render: (email: string) => (
                <span>
                    {email}
                    {email === currentEmail ? <Tag style={{marginLeft: 8}} color="green">{t('you')}</Tag> : null}
                </span>
            ),
        },
        {title: t('Name'), dataIndex: 'name', key: 'name'},
        {
            title: t('Role'),
            dataIndex: 'role',
            key: 'role',
            render: (role: UserRole = 'viewer') => {
                const r = ROLE_OPTIONS.find(o => o.value === role) ?? ROLE_OPTIONS[0];
                return <Tag color={r.color}>{t(r.label)}</Tag>;
            },
        },
        {
            title: t('Can publish'),
            dataIndex: 'canPublishProduction',
            key: 'canPublishProduction',
            width: 130,
            render: (canPublish: boolean) =>
                canPublish ? <Tag color="green">{t('Yes')}</Tag> : <Tag>{t('No')}</Tag>,
        },
        {
            title: t('Actions'),
            key: 'actions',
            width: 180,
            render: (_: unknown, user: IUser) => (
                <Space>
                    <Button size="small" icon={<EditOutlined/>} onClick={() => openEdit(user)}>
                        {t('Edit')}
                    </Button>
                    <Popconfirm
                        title={t('Remove user?')}
                        description={t('This cannot be undone.')}
                        okText={t('Remove')}
                        okButtonProps={{danger: true}}
                        cancelText={t('Cancel')}
                        disabled={user.email === currentEmail}
                        onConfirm={() => remove(user)}
                    >
                        <Button
                            size="small"
                            danger
                            icon={<DeleteOutlined/>}
                            disabled={user.email === currentEmail}
                        >
                            {t('Remove')}
                        </Button>
                    </Popconfirm>
                </Space>
            ),
        },
    ], [t, currentEmail]);

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}}>
                <Button type="primary" icon={<PlusOutlined/>} onClick={openCreate}>
                    {t('Add user')}
                </Button>
                <Button onClick={refresh} loading={loading}>{t('Refresh')}</Button>
            </Space>
            <Table
                rowKey="id"
                loading={loading}
                dataSource={users}
                columns={columns}
                pagination={{pageSize: 10}}
                size="middle"
            />
            <Modal
                title={editing?.id ? t('Edit user') : t('Add user')}
                open={editing !== null}
                onCancel={close}
                onOk={save}
                confirmLoading={saving}
                okText={editing?.id ? t('Save') : t('Create')}
            >
                <Form form={form} layout="vertical" preserve={false}>
                    <Form.Item
                        name="email"
                        label={t('Email')}
                        rules={[
                            {required: true, message: t('Email is required')},
                            {type: 'email', message: t('Enter a valid email')},
                        ]}
                    >
                        <Input disabled={!!editing?.id} autoComplete="off"/>
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
                        label={editing?.id ? t('New password (leave blank to keep)') : t('Password')}
                        rules={editing?.id ? [] : [{required: true, message: t('Password is required')}]}
                    >
                        <Input.Password autoComplete="new-password"/>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminSettingsUsers;
