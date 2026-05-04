import React, {useEffect, useMemo} from "react";
import {Button, Drawer, Form, Input, Popconfirm, Space, Table, Typography} from "antd";
import {DeleteOutlined, EditOutlined, PlusOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import ImageUrlInput from "@client/lib/ImageUrlInput";
import {IPost} from "@interfaces/IPost";
import {useRefreshView} from "@client/lib/refreshBus";
import ConflictDialog from "@client/lib/ConflictDialog";
import {useViewModel} from "@client/lib/state/observable";
import {PostsViewModel} from "./PostsViewModel";

/**
 * Simplified Posts pane — title + body + cover image only. No draft
 * state (every save publishes), no slug field (auto-derived), no
 * tags / author / excerpt, no per-row publish toggle, no blog-visible
 * switch. Drafts authored in the advanced view stay drafts; the
 * simplified author can edit them but every save flips `draft: false`.
 *
 * Shares `PostsViewModel` with the advanced view (admin-ui-modes
 * decision 4 — VM is shared).
 */
const PostsSimplifiedView: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new PostsViewModel(undefined, undefined, t));
    const [form] = Form.useForm();

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    useEffect(() => {
        if (vm.editing === null) return;
        form.resetFields();
        if (vm.editing.id) {
            form.setFieldsValue({
                title: vm.editing.title ?? '',
                coverImage: vm.editing.coverImage ?? '',
                body: vm.editing.body ?? '',
            });
        }
    }, [vm.editing, form]);

    const onSave = async () => {
        const values = await form.validateFields();
        // Preserve existing tags / author / excerpt / slug when editing —
        // the advanced view may have set them. Force `draft: false` so
        // simplified saves always publish.
        const merged = {
            ...(vm.editing ?? {}),
            ...values,
            draft: false,
        };
        await vm.save(merged);
        form.resetFields();
    };

    const columns = useMemo(() => [
        {
            title: t('Title'),
            dataIndex: 'title',
            key: 'title',
            render: (title: string) => <Typography.Text strong>{title}</Typography.Text>,
        },
        {
            title: t('Updated'),
            dataIndex: 'updatedAt',
            key: 'updatedAt',
            width: 160,
            render: (iso: string) => iso ? new Date(iso).toLocaleDateString() : '—',
        },
        {
            title: t('Actions'),
            key: 'actions',
            width: 160,
            render: (_: unknown, post: IPost) => (
                <Space size={4}>
                    <Button size="small" icon={<EditOutlined/>} onClick={() => vm.openEdit(post)}>{t('Edit')}</Button>
                    <Popconfirm
                        title={t('Delete post?')}
                        onConfirm={() => vm.remove(post)}
                        okText={t('Delete')}
                        okButtonProps={{danger: true}}
                        cancelText={t('Cancel')}
                    >
                        <Button size="small" danger icon={<DeleteOutlined/>}/>
                    </Popconfirm>
                </Space>
            ),
        },
    ], [t, vm]);

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}} align="center">
                <Button type="primary" icon={<PlusOutlined/>} onClick={vm.openCreate}>{t('New post')}</Button>
                <Button onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
            </Space>
            <Table
                rowKey="id"
                loading={vm.loading}
                dataSource={vm.posts}
                columns={columns}
                pagination={{pageSize: 20}}
                size="middle"
            />
            <Drawer
                open={vm.editing !== null}
                onClose={vm.close}
                title={vm.editing?.id ? t('Edit post') : t('New post')}
                width={640}
                destroyOnClose
                extra={<Button data-testid="posts-form-save-btn" type="primary" onClick={onSave} loading={vm.saving}>{t('Save')}</Button>}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="title" label={t('Title')} rules={[{required: true, message: t('Title is required')}]}>
                        <Input data-testid="posts-form-title-input"/>
                    </Form.Item>
                    <Form.Item name="coverImage" label={t('Cover image URL')}>
                        <ImageUrlInput data-testid="posts-form-cover-input" t={t} placeholder="api/cover.jpg"/>
                    </Form.Item>
                    <Form.Item name="body" label={t('Body')} rules={[{required: true, message: t('Body is required')}]}>
                        <Input.TextArea data-testid="posts-form-body-input" rows={12}/>
                    </Form.Item>
                </Form>
            </Drawer>
            {vm.conflict && (() => {
                const peer = vm.conflict.error.currentDoc as {editedBy?: string; editedAt?: string; title?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Post')}
                        peerVersion={vm.conflict.error.currentVersion}
                        peerEditedBy={peer?.editedBy}
                        peerEditedAt={peer?.editedAt}
                        onCancel={vm.dismissConflict}
                        onTakeTheirs={vm.takeTheirs}
                        onKeepMine={() => vm.conflict?.retry()}
                    />
                );
            })()}
        </div>
    );
};

export default PostsSimplifiedView;
