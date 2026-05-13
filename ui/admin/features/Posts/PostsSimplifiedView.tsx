import React, {useEffect, useMemo, ReactNode} from "react";
import {Button, Drawer, Form, Input, Popconfirm, Space, Table, Typography} from "antd";
import {DeleteOutlined, EditOutlined, PlusOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import ImageUrlInput from "@client/lib/ImageUrlInput";
import {IPost} from "@interfaces/IPost";
import {useRefreshView} from "@client/lib/refreshBus";
import ConflictDialog from "@client/lib/ConflictDialog";
import {useViewModel} from "@client/lib/state/observable";
import EmptyState from "@admin/lib/EmptyState";
import {PostsViewModel} from "./PostsViewModel";

interface Props {
    /** Slot for additional toolbar buttons (e.g. blog-visible switch in advanced mode). */
    headerExtra?: ReactNode;
    /** Extra columns appended to the simplified Title / Updated / Actions columns. */
    extraColumns?: any[];
    /** Per-row extra action buttons; called with the post. Advanced mode passes View / Publish-toggle. */
    renderRowExtras?: (post: IPost) => ReactNode;
    /**
     * Optional shared VM (advanced mode owns one with full editor /
     * pages list / conflict state and passes it down). Falls back to
     * a fresh VM in pure simplified mode.
     */
    vm?: PostsViewModel;
    /**
     * Override the default simplified Drawer body. Advanced mode
     * passes a richer Form (slug / tags / draft / page-pin / etc.)
     * but still uses the simplified table + create button.
     */
    renderDrawer?: (vm: PostsViewModel) => ReactNode;
    /**
     * Mode the pane is rendering as. Drives mode-prefixed row testid
     * (`posts-simplified-row-{id}` vs `posts-advanced-row-{id}`) per the
     * AUI hierarchy spec (2026-05-07). Defaults to 'simplified' — the
     * advanced view passes 'advanced' when composing this base.
     */
    mode?: 'simplified' | 'advanced';
    /** Optional extras rendered after the table (e.g. blog-visible row). */
    children?: ReactNode;
}

/**
 * Simplified Posts pane — title + body + cover image only. No draft
 * state (every save publishes), no slug field (auto-derived), no
 * tags / author / excerpt, no per-row publish toggle, no blog-visible
 * switch. Drafts authored in the advanced view stay drafts; the
 * simplified author can edit them but every save flips `draft: false`.
 *
 * Per `aui-mode-hierarchy.md` (2026-05-07) this is the **base
 * component**: the advanced view composes it via the slot props
 * (`headerExtra`, `extraColumns`, `renderRowExtras`, `renderDrawer`)
 * + a shared `vm`.
 */
const PostsSimplifiedView: React.FC<Props> = ({headerExtra, extraColumns, renderRowExtras, vm: vmProp, renderDrawer, mode = 'simplified', children}) => {
    const {t} = useTranslation();
    const ownVm = useViewModel(() => new PostsViewModel(undefined, undefined, t));
    const vm = vmProp ?? ownVm;
    const [form] = Form.useForm();

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    useEffect(() => {
        if (vm.editing === null) return;
        if (renderDrawer) return; // advanced mode owns the form
        form.resetFields();
        if (vm.editing.id) {
            form.setFieldsValue({
                title: vm.editing.title ?? '',
                coverImage: vm.editing.coverImage ?? '',
                body: vm.editing.body ?? '',
            });
        }
    }, [vm.editing, form, renderDrawer]);

    const onSave = async () => {
        const values = await form.validateFields();
        const merged = {
            ...(vm.editing ?? {}),
            ...values,
            draft: false,
        };
        await vm.save(merged);
        form.resetFields();
    };

    const columns = useMemo(() => {
        const baseCols: any[] = [
            {
                title: t('Title'),
                dataIndex: 'title',
                key: 'title',
                render: (title: string) => <Typography.Text strong>{title}</Typography.Text>,
            },
            ...(extraColumns ?? []),
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
                width: renderRowExtras ? 340 : 160,
                render: (_: unknown, post: IPost) => (
                    <Space size={4}>
                        <Button data-testid={`posts-row-${post.id}-edit-button`} size="small" icon={<EditOutlined/>} onClick={() => vm.openEdit(post)}>{t('Edit')}</Button>
                        {renderRowExtras?.(post)}
                        <Popconfirm
                            title={t('Delete post?')}
                            onConfirm={() => vm.remove(post)}
                            okText={t('Delete')}
                            okButtonProps={{danger: true, loading: vm.removeAction.pending}}
                            cancelText={t('Cancel')}
                        >
                            <Button data-testid={`posts-row-${post.id}-delete-button`} size="small" danger icon={<DeleteOutlined/>} loading={vm.removeAction.pending}/>
                        </Popconfirm>
                    </Space>
                ),
            },
        ];
        return baseCols;
    }, [t, vm, extraColumns, renderRowExtras]);

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}} align="center" wrap>
                <Button data-testid="posts-new-btn" type="primary" icon={<PlusOutlined/>} onClick={vm.openCreate}>{t('New post')}</Button>
                <Button data-testid="posts-refresh-button" onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
                {headerExtra}
            </Space>
            {!vm.loading && vm.posts.length === 0 ? (
                <EmptyState
                    testId={`posts-${mode}-empty-state`}
                    icon={<EditOutlined style={{fontSize: 48, opacity: 0.4}}/>}
                    title={t('empty.posts.title')}
                    description={t('empty.posts.description')}
                    primary={{
                        label: t('empty.posts.primary'),
                        onClick: () => vm.openCreate(),
                        testId: 'posts-empty-primary-btn',
                    }}
                />
            ) : (
                <Table
                    rowKey="id"
                    loading={vm.loading}
                    dataSource={vm.posts}
                    columns={columns}
                    pagination={{pageSize: 20}}
                    size="middle"
                    onRow={(p: IPost) => ({'data-testid': `posts-${mode}-row-${p.id}`, 'data-legacy-testid': `posts-row-${p.id}`} as any)}
                />
            )}
            {renderDrawer ? renderDrawer(vm) : (
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
            )}
            {children}
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
