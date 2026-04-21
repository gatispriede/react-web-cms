import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Button, Drawer, Form, Input, Popconfirm, Select, Space, Switch, Table, Tag, Typography, message} from "antd";
import {DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined} from "../../common/icons";
import {useTranslation} from "react-i18next";
import ImageUrlInput from "../../common/ImageUrlInput";
import PostApi from "../../../api/PostApi";
import SiteFlagsApi from "../../../api/SiteFlagsApi";
import {IPost, InPost} from "../../../../Interfaces/IPost";
import AuditBadge from "../AuditBadge";
import {useRefreshView} from "../../../lib/refreshBus";
import ConflictDialog from "../../common/ConflictDialog";
import {ConflictError, isConflictError} from "../../../lib/conflict";

const postApi = new PostApi();
const siteFlagsApi = new SiteFlagsApi();

const AdminSettingsPosts: React.FC = () => {
    const {t} = useTranslation();
    const [posts, setPosts] = useState<IPost[]>([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Partial<InPost> | null>(null);
    const [editingVersion, setEditingVersion] = useState<number | undefined>(undefined);
    const [conflict, setConflict] = useState<{error: ConflictError<any>; retry: () => Promise<void>} | null>(null);
    const [saving, setSaving] = useState(false);
    const [blogEnabled, setBlogEnabled] = useState(true);
    const [form] = Form.useForm();

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const [list, flags] = await Promise.all([
                postApi.list({includeDrafts: true, limit: 200}),
                siteFlagsApi.get(),
            ]);
            setPosts(list);
            setBlogEnabled(flags.blogEnabled !== false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);
    useRefreshView(refresh, 'settings');

    const toggleBlog = async (on: boolean) => {
        const prev = blogEnabled;
        setBlogEnabled(on);
        const result = await siteFlagsApi.save({blogEnabled: on});
        if ((result as any).error) {
            setBlogEnabled(prev);
            message.error((result as any).error);
            return;
        }
        message.success(on ? t('Blog enabled') : t('Blog hidden from the public site'));
    };

    const openCreate = () => {
        setEditing({draft: true, tags: []});
        setEditingVersion(undefined);
    };

    const openEdit = (post: IPost) => {
        setEditing(post);
        setEditingVersion(typeof post.version === 'number' ? post.version : 0);
    };

    // Drawer is `destroyOnClose`, so the inner Form re-mounts on every
    // open. `setFieldsValue` invoked synchronously inside open* handlers
    // used to no-op on the first edit click of a session because the
    // form hadn't mounted yet. Effect runs after the Form is in the
    // tree, so values land on first open too.
    useEffect(() => {
        if (editing === null) return;
        form.resetFields();
        if (editing.id) {
            form.setFieldsValue({
                title: editing.title ?? '',
                slug: editing.slug ?? '',
                excerpt: editing.excerpt ?? '',
                coverImage: editing.coverImage ?? '',
                tags: editing.tags ?? [],
                author: editing.author ?? '',
                body: editing.body ?? '',
                draft: editing.draft ?? false,
            });
        } else {
            form.setFieldsValue({draft: true, tags: []});
        }
    }, [editing, form]);

    const close = () => {
        setEditing(null);
        setEditingVersion(undefined);
        form.resetFields();
    };

    const performSave = useCallback(async (payload: InPost, expectedVersion: number | undefined) => {
        const result = await postApi.save(payload, expectedVersion);
        if (result.error) { message.error(result.error); return false; }
        message.success(payload.id ? t('Post updated') : t('Post created'));
        close();
        await refresh();
        return true;
    }, [refresh, t]);

    const save = async () => {
        const values = await form.validateFields();
        const payload: InPost = {
            id: editing?.id,
            title: values.title,
            slug: values.slug,
            excerpt: values.excerpt,
            coverImage: values.coverImage,
            tags: values.tags ?? [],
            author: values.author,
            body: values.body,
            draft: values.draft ?? false,
        };
        setSaving(true);
        try {
            await performSave(payload, editingVersion);
        } catch (err) {
            if (isConflictError(err)) {
                setConflict({
                    error: err,
                    retry: async () => {
                        setSaving(true);
                        try {
                            await performSave(payload, err.currentVersion);
                            setConflict(null);
                        } finally {
                            setSaving(false);
                        }
                    },
                });
            } else {
                message.error(String((err as Error)?.message ?? err));
            }
        } finally {
            setSaving(false);
        }
    };

    const remove = async (post: IPost) => {
        const result = await postApi.remove(post.id);
        if (result.error) { message.error(result.error); return; }
        message.success(t('Post deleted'));
        await refresh();
    };

    const togglePublish = async (post: IPost) => {
        const result = await postApi.setPublished(post.id, post.draft);
        if (result.error) { message.error(result.error); return; }
        message.success(result.draft ? t('Unpublished') : t('Published'));
        await refresh();
    };

    const latestAudit = useMemo(() => {
        let best: {editedBy?: string; editedAt?: string} = {};
        for (const p of posts) {
            const at = p.editedAt ?? p.updatedAt;
            if (at && (!best.editedAt || at > best.editedAt)) best = {editedBy: p.editedBy, editedAt: at};
        }
        return best;
    }, [posts]);

    const columns = useMemo(() => [
        {
            title: t('Title'),
            dataIndex: 'title',
            key: 'title',
            render: (title: string, post: IPost) => (
                <Space direction="vertical" size={0}>
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
            width: 260,
            render: (_: unknown, post: IPost) => (
                <Space size={4}>
                    <Button size="small" icon={<EditOutlined/>} onClick={() => openEdit(post)}>{t('Edit')}</Button>
                    <Button size="small" icon={<EyeOutlined/>} onClick={() => togglePublish(post)}>
                        {post.draft ? t('Publish') : t('Unpublish')}
                    </Button>
                    <Popconfirm
                        title={t('Delete post?')}
                        onConfirm={() => remove(post)}
                        okText={t('Delete')}
                        okButtonProps={{danger: true}}
                        cancelText={t('Cancel')}
                    >
                        <Button size="small" danger icon={<DeleteOutlined/>}/>
                    </Popconfirm>
                </Space>
            ),
        },
    ], [t]);

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}} align="center" wrap>
                <Button type="primary" icon={<PlusOutlined/>} onClick={openCreate}>{t('New post')}</Button>
                <Button onClick={refresh} loading={loading}>{t('Refresh')}</Button>
                <AuditBadge editedBy={latestAudit.editedBy} editedAt={latestAudit.editedAt}/>
                <Space>
                    <Switch checked={blogEnabled} onChange={toggleBlog}/>
                    <Typography.Text>
                        {blogEnabled ? t('Blog is visible to visitors') : t('Blog is hidden (no link, /blog returns 404)')}
                    </Typography.Text>
                </Space>
            </Space>
            <Table
                rowKey="id"
                loading={loading}
                dataSource={posts}
                columns={columns}
                pagination={{pageSize: 20}}
                size="middle"
            />
            <Drawer
                open={editing !== null}
                onClose={close}
                title={editing?.id ? t('Edit post') : t('New post')}
                width={720}
                destroyOnClose
                extra={<Button type="primary" onClick={save} loading={saving}>{t('Save')}</Button>}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="title" label={t('Title')} rules={[{required: true, message: t('Title is required')}]}>
                        <Input/>
                    </Form.Item>
                    <Form.Item name="slug" label={t('Slug')} tooltip={t('Leave blank to auto-generate from the title.')}>
                        <Input placeholder="my-first-post"/>
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
                        <Input.TextArea rows={12}/>
                    </Form.Item>
                    <Form.Item name="draft" label={t('Draft')} valuePropName="checked">
                        <Switch/>
                    </Form.Item>
                </Form>
            </Drawer>
            {conflict && (() => {
                const peer = conflict.error.currentDoc as {editedBy?: string; editedAt?: string; title?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Post')}
                        peerVersion={conflict.error.currentVersion}
                        peerEditedBy={peer?.editedBy}
                        peerEditedAt={peer?.editedAt}
                        onCancel={() => setConflict(null)}
                        onTakeTheirs={async () => {
                            setConflict(null);
                            close();
                            await refresh();
                        }}
                        onKeepMine={async () => {
                            try { await conflict.retry(); }
                            catch (err) { message.error(String((err as Error)?.message ?? err)); setConflict(null); }
                        }}
                    />
                );
            })()}
        </div>
    );
};

export default AdminSettingsPosts;
