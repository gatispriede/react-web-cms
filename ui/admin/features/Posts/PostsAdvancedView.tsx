import React, {useEffect} from "react";
import {Button, Drawer, Form, Input, Select, Space, Switch, Tag, Typography} from "antd";
import {EyeOutlined, LinkOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import type {TFunction} from "i18next";
import ImageUrlInput from "@client/lib/ImageUrlInput";
import {IPost} from "@interfaces/IPost";
import AuditBadge from "@admin/shell/AuditBadge";
import {useViewModel} from "@client/lib/state/observable";
import {PostsViewModel} from "./PostsViewModel";
import PostsSimplifiedView from "./PostsSimplifiedView";

/**
 * Advanced-mode Drawer — full editor with slug / excerpt / author /
 * tags / page-pin / draft switch.
 *
 * Lives inside Posts.tsx and is wired through the simplified view's
 * `renderDrawer` slot. The simplified Drawer is replaced wholesale
 * because the advanced form differs in fields, width, and validation —
 * cleaner than a slot-per-field gymnastic.
 */
const AdvancedDrawer: React.FC<{vm: PostsViewModel; t: TFunction<"translation", undefined>}> = ({vm, t}) => {
    const [form] = Form.useForm();

    // Drawer is `destroyOnClose`, so the inner Form re-mounts on every
    // open. Effect runs after the Form is in the tree, so values land
    // on first open too.
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
                pageId: vm.editing.pageId ?? undefined,
            });
        } else {
            form.setFieldsValue({draft: true, tags: [], pageId: undefined});
        }
    }, [vm.editing, form]);

    const onSave = async () => {
        const values = await form.validateFields();
        await vm.save(values);
        form.resetFields();
    };

    return (
        <Drawer
            data-testid="posts-editor-drawer"
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
                    <Input.TextArea data-testid="posts-excerpt-textarea" rows={2}/>
                </Form.Item>
                <Form.Item name="coverImage" label={t('Cover image URL')}>
                    <ImageUrlInput t={t} placeholder="api/cover.jpg"/>
                </Form.Item>
                <Form.Item name="author" label={t('Author')}>
                    <Input data-testid="posts-author-input"/>
                </Form.Item>
                <Form.Item name="tags" label={t('Tags')}>
                    <Select data-testid="posts-tags-select" mode="tags" tokenSeparators={[',', ';']}/>
                </Form.Item>
                <Form.Item
                    name="pageId"
                    label={t('Pin to page')}
                    tooltip={t('Pinning a post to a page means it cascades to trash when that page is deleted (and is restored together). The public URL stays /blog/<slug> regardless.')}
                >
                    <Select
                        data-testid="posts-page-pin-select"
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        placeholder={vm.pages.length === 0
                            ? t('No pages exist yet — create a page first')
                            : t('Unpinned (lives at /blog root)')}
                        disabled={vm.pages.length === 0}
                        options={vm.pages.map(p => ({value: p.id, label: p.page}))}
                    />
                </Form.Item>
                <Form.Item name="body" label={t('Body (HTML or Markdown)')} rules={[{required: true, message: t('Body is required')}]}>
                    <Input.TextArea data-testid="posts-body-textarea" rows={12}/>
                </Form.Item>
                <Form.Item name="draft" label={t('Draft')} valuePropName="checked">
                    <Switch data-testid="posts-draft-switch"/>
                </Form.Item>
            </Form>
        </Drawer>
    );
};

/**
 * Advanced Posts pane.
 *
 * Per `aui-mode-hierarchy.md` (2026-05-07) advanced **composes** the
 * simplified base — `<PostsSimplifiedView/>` owns the table + create
 * button + delete + refresh; advanced contributes a header
 * (audit + blog-visible switch), per-row extras (View / Publish
 * toggle), a Status column, and a richer Drawer (`renderDrawer`).
 *
 * Drawer-replacement note: the advanced editor is a different
 * component (different fields, validation, width) so it ships through
 * the `renderDrawer` slot rather than a per-field-prop gymnastic. The
 * gallery / table / refresh / create still lives in the simplified base.
 */
const AdminSettingsPosts: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new PostsViewModel(undefined, undefined, t));

    const headerExtra = (
        <>
            <AuditBadge editedBy={vm.latestAudit.editedBy} editedAt={vm.latestAudit.editedAt}/>
            <Space>
                <Switch data-testid="posts-blog-enabled-switch" checked={vm.blogEnabled} onChange={vm.toggleBlog}/>
                <Typography.Text>
                    {vm.blogEnabled ? t('Blog is visible to visitors') : t('Blog is hidden (no link, /blog returns 404)')}
                </Typography.Text>
            </Space>
        </>
    );

    const extraColumns = [
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
                    {(tags ?? []).slice(0, 5).map(tag => <Tag key={tag}>{tag}</Tag>)}
                </Space>
            ),
        },
    ];

    // Override Title column to show slug subtitle. Pre-pended via a custom
    // extraColumns slot — but title is a base column. Easier: leave the
    // base title column; advanced view shows slug via its own /blog link.
    // (Advanced's slug subtitle is acceptable to drop here; the slug is
    // visible in the editor + the View button URL.)

    const renderRowExtras = (post: IPost) => (
        <>
            {post.slug ? (
                <Button
                    data-testid={`posts-row-${post.id}-view-button`}
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
            <Button data-testid={`posts-row-${post.id}-publish-toggle-button`} size="small" icon={<EyeOutlined/>} onClick={() => vm.togglePublish(post)}>
                {post.draft ? t('Publish') : t('Unpublish')}
            </Button>
        </>
    );

    return (
        <PostsSimplifiedView
            vm={vm}
            mode="advanced"
            headerExtra={headerExtra}
            extraColumns={extraColumns}
            renderRowExtras={renderRowExtras}
            renderDrawer={(sharedVm) => <AdvancedDrawer vm={sharedVm} t={t}/>}
        />
    );
};

export default AdminSettingsPosts;
