/**
 * admin-module-composed — Redirects bridge.
 *
 * The `AdminLoader` bridge for `system/redirects`. `RedirectsViewModel`
 * is unchanged ("admin stays mostly same"); the hand-coded list chrome
 * (Card + Table + EmptyState) is replaced by `AdminCrudListModule`, and
 * the bespoke create/edit Modal is kept rendered alongside the module.
 *
 * Registered with the `AdminPageRegistry` by `RedirectsAdminLoader`; the
 * shell reaches it via `AdminPageDispatch` (see `RedirectsAdminUILoader`).
 */
import React, {useEffect} from 'react';
import {Button, Form, Input, Modal, Select, Space, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import AdminCrudListModule from '@admin/modules/shapes/AdminCrudListModule';
import {RedirectsViewModel} from './RedirectsViewModel';
import type {IRedirect} from '@interfaces/IRedirect';

/**
 * Admin pane for the W8h SEO redirect table.
 *
 * Lists every row, supports create / edit / delete via a modal. The
 * `code` picker is a constrained `<Select options>` per the codebase
 * "predefined selections" convention — 301 / 302 are the only valid
 * values, so free text is banned.
 */
const RedirectsPane: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new RedirectsViewModel());
    const [form] = Form.useForm<IRedirect>();

    useEffect(() => { void vm.refresh(); }, [vm]);

    useEffect(() => {
        if (vm.editing) {
            form.setFieldsValue({
                ...vm.editing,
                code: vm.editing.code ?? 301,
            });
        } else {
            form.resetFields();
        }
    }, [vm.editing, form]);

    const columns = [
        {title: t('From'), dataIndex: 'from', key: 'from'},
        {title: t('To'), dataIndex: 'to', key: 'to'},
        {title: t('Code'), dataIndex: 'code', key: 'code', width: 80},
        {
            title: t('Note'),
            dataIndex: 'note',
            key: 'note',
            ellipsis: true,
        },
        {
            title: t('Actions'),
            key: 'actions',
            width: 160,
            render: (_: unknown, row: IRedirect) => (
                <Space>
                    <Button
                        size="small"
                        data-testid={`redirects-row-${row.id}-edit-button`}
                        onClick={() => vm.setEditing(row)}
                    >
                        {t('Edit')}
                    </Button>
                    <Button
                        size="small"
                        danger
                        data-testid={`redirects-row-${row.id}-delete-button`}
                        onClick={() => row.id && void vm.remove(row.id)}
                    >
                        {t('Delete')}
                    </Button>
                </Space>
            ),
        },
    ];

    return (
        <>
            <AdminCrudListModule
                testId="redirects-pane"
                title={t('URL redirects')}
                columns={columns as unknown as ColumnsType<Record<string, unknown>>}
                rows={vm.rows as unknown as ReadonlyArray<Record<string, unknown>>}
                rowKey="id"
                loading={vm.loading}
                pageSize={50}
                onRefresh={() => void vm.refresh()}
                refreshTestId="redirects-refresh-button"
                onAdd={() => vm.openCreate()}
                addLabel={t('New redirect')}
                addTestId="redirects-create-button"
                emptyState={{
                    testId: 'redirects-empty-state',
                    title: t('No redirects yet'),
                    description: t('Add a redirect when retiring a URL or restructuring your site.'),
                    art: 'generic',
                    primary: {
                        label: t('New redirect'),
                        onClick: () => vm.openCreate(),
                        testId: 'redirects-empty-primary-btn',
                    },
                }}
            />
            <Typography.Paragraph type="secondary" style={{padding: '0 16px'}}>
                {t('Exact-path redirects consulted by the edge middleware before route resolution. Source paths must start with /. Targets can be relative or absolute.')}
            </Typography.Paragraph>

            <Modal
                open={vm.editing !== null}
                title={vm.editing?.id ? t('Edit redirect') : t('New redirect')}
                onCancel={() => vm.setEditing(null)}
                onOk={() => form.submit()}
                okText={t('Save')}
                cancelText={t('Cancel')}
                confirmLoading={vm.saving}
                destroyOnClose
                data-testid="redirects-editor-modal"
            >
                <Form<IRedirect>
                    form={form}
                    layout="vertical"
                    initialValues={{code: 301}}
                    onFinish={(values) => void vm.save({...vm.editing, ...values} as IRedirect)}
                >
                    <Form.Item
                        label={t('From (source path)')}
                        name="from"
                        rules={[{required: true, message: t('Source path is required')}]}
                    >
                        <Input
                            data-testid="redirects-editor-from-input"
                            placeholder="/old-page"
                        />
                    </Form.Item>
                    <Form.Item
                        label={t('To (target URL or path)')}
                        name="to"
                        rules={[{required: true, message: t('Target is required')}]}
                    >
                        <Input
                            data-testid="redirects-editor-to-input"
                            placeholder="/new-page"
                        />
                    </Form.Item>
                    <Form.Item label={t('Code')} name="code">
                        <Select
                            data-testid="redirects-editor-code-select"
                            options={[
                                {value: 301, label: t('301 — permanent')},
                                {value: 302, label: t('302 — temporary')},
                            ]}
                        />
                    </Form.Item>
                    <Form.Item label={t('Note (optional)')} name="note">
                        <Input.TextArea
                            data-testid="redirects-editor-note-textarea"
                            rows={2}
                            maxLength={500}
                            showCount
                        />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};

export default RedirectsPane;
