import React, {useCallback, useEffect, useMemo, useState} from "react";
import {Button, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip, Typography, message} from "antd";
import {DeleteOutlined, EditOutlined, EyeOutlined, LinkOutlined, PlusOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import ProductApi from "@services/api/client/ProductApi";
import {IProduct, InProduct} from "@interfaces/IProduct";
import AuditBadge from "@admin/shell/AuditBadge";
import {useRefreshView} from "@client/lib/refreshBus";
import ConflictDialog from "@client/lib/ConflictDialog";
import {ConflictError, isConflictError} from "@client/lib/conflict";

/**
 * Admin Products pane. Mirrors `Posts.tsx` shape: list pane + edit drawer with
 * conflict handling, version bumping, and ISR revalidation through ProductApi.
 *
 * `source === 'warehouse'` rows render with disabled fields (price, stock,
 * sku, images, attributes, variants) — the warehouse adapter owns those
 * fields and overwrites them on each sync. Manual fields (categories,
 * description, slug) stay editable.
 *
 * DECISION: the spec's "Translations" sub-tab (CSV editor pre-filtered to
 * `product.<slug>.*` keys) is deferred — the existing CSV-editor wire-up
 * in Posts is non-trivial to factor out and the public page already routes
 * through `useTranslation` with the doc value as fallback (see
 * `ui/client/pages/products/[slug].tsx`). Follow-up task can add the tab.
 */

const productApi = new ProductApi();

const WAREHOUSE_OWNED_FIELDS: ReadonlyArray<keyof InProduct> = ['price', 'stock', 'sku', 'images', 'attributes', 'variants'];

const AdminSettingsProducts: React.FC = () => {
    const {t} = useTranslation();
    const [products, setProducts] = useState<IProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Partial<InProduct & {source?: 'manual' | 'warehouse'}> | null>(null);
    const [editingVersion, setEditingVersion] = useState<number | undefined>(undefined);
    const [conflict, setConflict] = useState<{error: ConflictError<any>; retry: () => Promise<void>} | null>(null);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [form] = Form.useForm();

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const list = await productApi.list({includeDrafts: true, limit: 200});
            setProducts(list);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);
    useRefreshView(refresh, 'settings');

    const filtered = useMemo(() => {
        if (!search.trim()) return products;
        const q = search.trim().toLowerCase();
        return products.filter(p =>
            (p.title || '').toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q),
        );
    }, [products, search]);

    const openCreate = () => {
        setEditing({draft: true, source: 'manual', currency: 'EUR', price: 0, stock: 0, categories: [], images: [], attributes: {}, variants: []});
        setEditingVersion(undefined);
    };

    const openEdit = (product: IProduct) => {
        setEditing(product);
        setEditingVersion(typeof product.version === 'number' ? product.version : 0);
    };

    useEffect(() => {
        if (editing === null) return;
        form.resetFields();
        if (editing.id) {
            form.setFieldsValue({
                title: editing.title ?? '',
                slug: editing.slug ?? '',
                sku: editing.sku ?? '',
                description: editing.description ?? '',
                price: editing.price ?? 0,
                currency: editing.currency ?? 'EUR',
                stock: editing.stock ?? 0,
                categories: editing.categories ?? [],
                images: (editing.images ?? []).join('\n'),
                draft: editing.draft ?? false,
            });
        } else {
            form.setFieldsValue({draft: true, currency: 'EUR', price: 0, stock: 0, categories: [], images: ''});
        }
    }, [editing, form]);

    const close = () => {
        setEditing(null);
        setEditingVersion(undefined);
        form.resetFields();
    };

    const isWarehouse = editing?.source === 'warehouse';
    const fieldDisabled = (name: keyof InProduct) =>
        isWarehouse && (WAREHOUSE_OWNED_FIELDS as readonly string[]).includes(name as string);
    const warehouseTooltip = t('Synced from warehouse — some fields are read-only');

    const performSave = useCallback(async (payload: InProduct, expectedVersion: number | undefined) => {
        const result = await productApi.save(payload, expectedVersion);
        if (result.error) { message.error(result.error); return false; }
        const requestedSlug = (payload.slug || '').trim();
        const finalSlug = (result.slug || '').trim();
        if (finalSlug && requestedSlug && finalSlug !== requestedSlug) {
            message.warning(
                `${t('Slug "{{requested}}" was already taken — saved as "{{final}}"', {requested: requestedSlug, final: finalSlug})}`,
                6,
            );
        } else {
            message.success(payload.id ? t('Product updated') : t('Product created'));
        }
        close();
        await refresh();
        return true;
    }, [refresh, t]);

    const save = async () => {
        const values = await form.validateFields();
        const images = String(values.images ?? '').split('\n').map((s: string) => s.trim()).filter(Boolean);
        const payload: InProduct = {
            id: editing?.id,
            title: values.title,
            slug: values.slug,
            sku: values.sku,
            description: values.description,
            price: Number(values.price ?? 0),
            currency: values.currency,
            stock: Number(values.stock ?? 0),
            categories: values.categories ?? [],
            images,
            attributes: editing?.attributes ?? {},
            variants: editing?.variants ?? [],
            source: editing?.source ?? 'manual',
            externalId: editing?.externalId,
            manualOverrides: editing?.manualOverrides,
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

    const remove = async (product: IProduct) => {
        const result = await productApi.remove(product.id);
        if (result.error) { message.error(result.error); return; }
        message.success(t('Product deleted'));
        await refresh();
    };

    const togglePublish = async (product: IProduct) => {
        const result = await productApi.setPublished(product.id, product.draft);
        if (result.error) { message.error(result.error); return; }
        message.success(result.draft ? t('Unpublished') : t('Published'));
        await refresh();
    };

    const formatPrice = (amount: number, currency: string) => {
        try {
            return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'EUR'}).format((amount ?? 0) / 100);
        } catch {
            return `${(amount ?? 0) / 100} ${currency}`;
        }
    };

    const latestAudit = useMemo(() => {
        let best: {editedBy?: string; editedAt?: string} = {};
        for (const p of products) {
            const at = p.editedAt ?? p.updatedAt;
            if (at && (!best.editedAt || at > best.editedAt)) best = {editedBy: p.editedBy, editedAt: at};
        }
        return best;
    }, [products]);

    const columns = useMemo(() => [
        {
            title: t('Title'),
            dataIndex: 'title',
            key: 'title',
            render: (title: string, p: IProduct) => (
                <Space orientation="vertical" size={0}>
                    <Typography.Text strong>{title}</Typography.Text>
                    <Typography.Text type="secondary" style={{fontSize: '.85em'}}>/products/{p.slug}</Typography.Text>
                </Space>
            ),
        },
        {title: t('SKU'), dataIndex: 'sku', key: 'sku', width: 140},
        {
            title: t('Price'),
            key: 'price',
            width: 120,
            render: (_: unknown, p: IProduct) => formatPrice(p.price, p.currency),
        },
        {
            title: t('Stock'),
            dataIndex: 'stock',
            key: 'stock',
            width: 90,
            render: (s: number) => (typeof s === 'number' ? s : '—'),
        },
        {
            title: t('Source'),
            dataIndex: 'source',
            key: 'source',
            width: 120,
            render: (src: string) => src === 'warehouse'
                ? <Tooltip title={warehouseTooltip}><Tag color="blue">{t('Warehouse')}</Tag></Tooltip>
                : <Tag>{t('Manual')}</Tag>,
        },
        {
            title: t('Status'),
            dataIndex: 'draft',
            key: 'draft',
            width: 110,
            render: (draft: boolean) => draft ? <Tag>{t('Draft')}</Tag> : <Tag color="green">{t('Published')}</Tag>,
        },
        {
            title: t('Actions'),
            key: 'actions',
            width: 340,
            render: (_: unknown, p: IProduct) => (
                <Space size={4}>
                    <Button size="small" icon={<EditOutlined/>} onClick={() => openEdit(p)}>{t('Edit')}</Button>
                    {p.slug ? (
                        <Button
                            size="small"
                            icon={<LinkOutlined/>}
                            href={`/products/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            disabled={p.draft}
                            title={p.draft ? t('Publish to view') : `/products/${p.slug}`}
                        >
                            {t('View')}
                        </Button>
                    ) : null}
                    <Button size="small" icon={<EyeOutlined/>} onClick={() => togglePublish(p)}>
                        {p.draft ? t('Publish') : t('Unpublish')}
                    </Button>
                    <Popconfirm
                        title={t('Delete product?')}
                        onConfirm={() => remove(p)}
                        okText={t('Delete')}
                        okButtonProps={{danger: true}}
                        cancelText={t('Cancel')}
                    >
                        <Button size="small" danger icon={<DeleteOutlined/>}/>
                    </Popconfirm>
                </Space>
            ),
        },
    ], [t, warehouseTooltip]);

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}} align="center" wrap>
                <Button type="primary" icon={<PlusOutlined/>} onClick={openCreate}>{t('New product')}</Button>
                <Button onClick={refresh} loading={loading}>{t('Refresh')}</Button>
                <Input.Search
                    placeholder={t('Search title or SKU')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{width: 240}}
                />
                <AuditBadge editedBy={latestAudit.editedBy} editedAt={latestAudit.editedAt}/>
            </Space>
            <Table
                rowKey="id"
                loading={loading}
                dataSource={filtered}
                columns={columns}
                pagination={{pageSize: 20}}
                size="middle"
            />
            <Drawer
                open={editing !== null}
                onClose={close}
                title={editing?.id ? t('Edit product') : t('New product')}
                width={720}
                destroyOnClose
                extra={<Button type="primary" onClick={save} loading={saving}>{t('Save')}</Button>}
            >
                {isWarehouse && (
                    <Typography.Paragraph type="secondary" style={{marginBottom: 12}}>
                        {warehouseTooltip}
                    </Typography.Paragraph>
                )}
                <Form form={form} layout="vertical">
                    <Form.Item name="title" label={t('Title')} rules={[{required: true, message: t('Title is required')}]}>
                        <Input/>
                    </Form.Item>
                    <Form.Item name="slug" label={t('Slug')} tooltip={t('Leave blank to auto-generate from the title.')}>
                        <Input placeholder="my-product"/>
                    </Form.Item>
                    <Form.Item name="sku" label={t('SKU')} rules={[{required: true, message: t('SKU is required')}]}>
                        <Input disabled={fieldDisabled('sku')}/>
                    </Form.Item>
                    <Form.Item name="description" label={t('Description (Markdown)')}>
                        <Input.TextArea rows={6}/>
                    </Form.Item>
                    <Space>
                        <Form.Item name="price" label={t('Price (minor units)')} rules={[{required: true, message: t('Price is required')}]}>
                            <InputNumber min={0} step={1} disabled={fieldDisabled('price')}/>
                        </Form.Item>
                        <Form.Item name="currency" label={t('Currency')} rules={[{required: true}]}>
                            <Input style={{width: 90}} maxLength={3}/>
                        </Form.Item>
                        <Form.Item name="stock" label={t('Stock')}>
                            <InputNumber min={0} step={1} disabled={fieldDisabled('stock')}/>
                        </Form.Item>
                    </Space>
                    <Form.Item name="categories" label={t('Categories')}>
                        <Select mode="tags" tokenSeparators={[',', ';']}/>
                    </Form.Item>
                    <Form.Item
                        name="images"
                        label={t('Images (one URL per line)')}
                        tooltip={t('Reuse the existing assets picker by pasting URLs returned from the Assets manager.')}
                    >
                        <Input.TextArea rows={4} disabled={fieldDisabled('images')} placeholder="https://…"/>
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
                        docKind={t('Product')}
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

export default AdminSettingsProducts;
