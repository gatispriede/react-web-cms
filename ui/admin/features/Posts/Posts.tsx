import React, {useEffect, useMemo} from "react";
import {Button, Drawer, Form, Input, Popconfirm, Select, Space, Switch, Table, Tag, Typography} from "antd";
import {DeleteOutlined, EditOutlined, EyeOutlined, LinkOutlined, PlusOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import ImageUrlInput from "@client/lib/ImageUrlInput";
import {IPost} from "@interfaces/IPost";
import AuditBadge from "@admin/shell/AuditBadge";
import {useRefreshView} from "@client/lib/refreshBus";
import ConflictDialog from "@client/lib/ConflictDialog";
import {useViewModel} from "@client/lib/state/observable";
import {PostsViewModel} from "./PostsViewModel";

/**
 * Admin "Posts" pane — render-only shell over `PostsViewModel`.
 *
 * Migrated from inline `useState` walls to a class-based view-model
 * (VM2 proof case for `view-model-classes.md`, 2026-05-02). Component
 * holds NO state of its own except the AntD `Form.useForm` instance
 * (form values are a UI primitive, not vm state). Every mutation flows
 * through a method on the VM.
 */
const AdminSettingsPosts: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new PostsViewModel(undefined, undefined, t));
    const [form] = Form.useForm();

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    // Drawer is `destroyOnClose`, so the inner Form re-mounts on every
    // open. Effect runs after the Form is in the tree, so values land
    // on first open too — same dance as the legacy implementation.
    useEffect(() => {
        if (vm.editing === null) return;
        form.resetFields();
        if (vm.editing.id) {
            form.setFieldsValue({
                title: vm.editing.title ?? '',
                slug: vm.editing.slug ?? '',
                excerpt: vm.editing.excerpt ?? '',
                coverImage: vm.editing.coverImage ?? '',
                tags: vm.editing.tags ?? [],
                author: vm.editing.author ?? '',
                body: vm.editing.body ?? '',
                draft: vm.editing.draft ?? false,
            });
        } else {
            form.setFieldsValue({draft: true, tags: []});
        }
    }, [vm.editing, form]);

    const onSave = async () => {
        const values = await form.validateFields();
        await vm.save(values);
        form.resetFields();
    };

    const columns = useMemo(() => [
        {
            title: t('Title'),
            dataIndex: 'title',
            key: 'title',
            render: (title: string, post: IPost) => (
                <Space orientation="vertical" size={0}>
                    <Typography.Text strong>{title}</Typography.Text>
                    <Typography.Text type="secondary" style={{fontSize: '.85em'}}>/{post.slug}</Typography.Text>
                </Space>
            ),
        },
        {
            title: t('Status'),
            dataIndex: 'draft',
            key: 'draft',
            width: 120,
            render: (draft: boolean) => draft
                ? <Tag>{t('Draft')}</Tag>
                : <Tag color="green">{t('Published')}</Tag>,
        },
        {
            title: t('Tags'),
            dataIndex: 'tags',
            key: 'tags',
            render: (tags: string[]) => (
                <Space size={4} wrap>
                    {tags.slice(0, 5).map(tag => <Tag key={tag}>{tag}</Tag>)}
                </Space>
            ),
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
            width: 340,
            render: (_: unknown, post: IPost) => (
                <Space size={4}>
                    <Button size="small" icon={<EditOutlined/>} onClick={() => vm.openEdit(post)}>{t('Edit')}</Button>
                    {/* Always pulls the slug from the row, so a server-side
                        rename (collision-bump) is automatically reflected
                        once `vm.refresh()` repopulates after save — no stale
                        URL ever lingers in the admin. */}
                    {post.slug ? (
                        <Button
                            size="small"
                            icon={<LinkOutlined/>}
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            disabled={post.draft}
                            title={post.draft ? t('Publish to view') : `/blog/${post.slug}`}
                        >
                            {t('View')}
                        </Button>
                    ) : null}
                    <Button size="small" icon={<EyeOutlined/>} onClick={() => vm.togglePublish(post)}>
                        {post.draft ? t('Publish') : t('Unpublish')}
                    </Button>
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
            <Space style={{marginBottom: 16}} align="center" wrap>
                <Button data-testid="posts-new-btn" type="primary" icon={<PlusOutlined/>} onClick={vm.openCreate}>{t('New post')}</Button>
                <Button onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
                <AuditBadge editedBy={vm.latestAudit.editedBy} editedAt={vm.latestAudit.editedAt}/>
                <Space>
                    <Switch checked={vm.blogEnabled} onChange={vm.toggleBlog}/>
                    <Typography.Text>
                        {vm.blogEnabled ? t('Blog is visible to visitors') : t('Blog is hidden (no link, /blog returns 404)')}
                    </Typography.Text>
                </Space>
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
                width={720}
                destroyOnClose
                extra={<Button data-testid="posts-save-btn" type="primary" onClick={onSave} loading={vm.saving}>{t('Save')}</Button>}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="title" label={t('Title')} rules={[{required: true, message: t('Title is required')}]}>
                        <Input data-testid="posts-title-input"/>
                    </Form.Item>
                    <Form.Item name="slug" label={t('Slug')} tooltip={t('Leave blank to auto-generate from the title.')}>
                        <Input data-testid="posts-slug-input" placeholder="my-first-post"/>
                    </Form.Item>
                    <Form.Item name="excerpt" label={t('Excerpt')}>
                        <Input.TextArea rows={2}/>
                    </Form.Item>
                    <Form.Item name="coverImage" label={t('Cover image URL')}>
                        <ImageUrlInput t={t} placeholder="api/cover.jpg"/>
                    </Form.Item>
                    <Form.Item name="author" label={t('Author')}>
                        <Input/>
                    </Form.Item>
                    <Form.Item name="tags" label={t('Tags')}>
                        <Select mode="tags" tokenSeparators={[',', ';']}/>
                    </Form.Item>
                    <Form.Item name="body" label={t('Body (HTML or Markdown)')} rules={[{required: true, message: t('Body is required')}]}>
                        <Input.TextArea data-testid="posts-body-textarea" rows={12}/>
                    </Form.Item>
                    <Form.Item name="draft" label={t('Draft')} valuePropName="checked">
                        <Switch data-testid="posts-draft-switch"/>
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

export default AdminSettingsPosts;
