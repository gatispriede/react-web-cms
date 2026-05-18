/**
 * admin-module-composed (Batch 2) — Products bridge.
 *
 * The `AdminLoader` bridge for `content/products`. `ProductsViewModel`
 * is unchanged ("admin stays mostly same"); the hand-coded list chrome
 * (toolbar + Table + EmptyState) is replaced by `AdminCrudListModule`,
 * and the bespoke edit Drawer + the conflict dialog (now via
 * `AdminConflictModule`) are kept rendered alongside the module.
 *
 * Registered with the `AdminPageRegistry` by `ProductsAdminLoader`; the
 * shell reaches it via `AdminPageDispatch` (see `ProductsAdminUILoader`).
 */
import React, {useEffect, useMemo} from "react";
import {Button, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Switch, Tag, Tooltip, Typography} from "antd";
import {notifyError} from '@admin/lib/notify';
import type {ColumnsType} from "antd/es/table";
import {DeleteOutlined, EditOutlined, EyeOutlined, LinkOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import {IProduct, InProduct} from "@interfaces/IProduct";
import AuditBadge from "@admin/shell/AuditBadge";
import {useRefreshView} from "@client/lib/useRefreshView";
import {useViewModel} from "@client/lib/state/observable";
import AdminCrudListModule from "@admin/modules/shapes/AdminCrudListModule";
import AdminConflictModule from "@admin/modules/shapes/AdminConflictModule";
import {onboardingCta} from "@admin/lib/EmptyState";
import {ProductsViewModel} from "./ProductsViewModel";
import TemplatePickerControl from "./TemplatePickerControl";

/** Render-only Products pane — VM3 (2026-05-02). */

const AdminSettingsProducts: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new ProductsViewModel(undefined, t));
    const [form] = Form.useForm();

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    const warehouseTooltip = t('Synced from warehouse — some fields are read-only');

    useEffect(() => {
        if (vm.editing === null) return;
        form.resetFields();
        if (vm.editing.id) {
            form.setFieldsValue({
                title: vm.editing.title ?? '',
                slug: vm.editing.slug ?? '',
                sku: vm.editing.sku ?? '',
                description: vm.editing.description ?? '',
                price: vm.editing.price ?? 0,
                currency: vm.editing.currency ?? 'EUR',
                stock: vm.editing.stock ?? 0,
                categories: vm.editing.categories ?? [],
                images: (vm.editing.images ?? []).join('\n'),
                draft: vm.editing.draft ?? false,
                templateId: (vm.editing as {templateId?: string}).templateId ?? '',
            });
        } else {
            form.setFieldsValue({draft: true, currency: 'EUR', price: 0, stock: 0, categories: [], images: '', templateId: ''});
        }
    }, [vm.editing, form]);

    const onSave = async () => {
        const values = await form.validateFields();
        await vm.save(values);
        form.resetFields();
    };

    const onClose = () => {
        vm.close();
        form.resetFields();
    };

    const formatPrice = (amount: number, currency: string) => {
        try { return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'EUR'}).format((amount ?? 0) / 100); }
        catch { return `${(amount ?? 0) / 100} ${currency}`; }
    };

    const columns = useMemo(() => [
        {title: t('Title'), dataIndex: 'title', key: 'title',
            render: (title: string, p: IProduct) => (
                <Space orientation="vertical" size={0}>
                    <Typography.Text strong>{title}</Typography.Text>
                    <Typography.Text type="secondary" style={{fontSize: '.85em'}}>/products/{p.slug}</Typography.Text>
                </Space>
            )},
        {title: t('SKU'), dataIndex: 'sku', key: 'sku', width: 140},
        {title: t('Price'), key: 'price', width: 120,
            render: (_: unknown, p: IProduct) => formatPrice(p.price, p.currency)},
        {title: t('Stock'), dataIndex: 'stock', key: 'stock', width: 90,
            render: (s: number) => (typeof s === 'number' ? s : '—')},
        {title: t('Source'), dataIndex: 'source', key: 'source', width: 120,
            render: (src: string) => src === 'warehouse'
                ? <Tooltip title={warehouseTooltip}><Tag color="blue">{t('Warehouse')}</Tag></Tooltip>
                : <Tag>{t('Manual')}</Tag>},
        {title: t('Status'), dataIndex: 'draft', key: 'draft', width: 110,
            render: (draft: boolean) => draft ? <Tag>{t('Draft')}</Tag> : <Tag color="green">{t('Published')}</Tag>},
        {title: t('Actions'), key: 'actions', width: 340,
            render: (_: unknown, p: IProduct) => (
                <Space size={4}>
                    <Button size="small" icon={<EditOutlined/>} onClick={() => vm.openEdit(p)}>{t('Edit')}</Button>
                    {p.slug ? (
                        <Button
                            size="small"
                            icon={<LinkOutlined/>}
                            href={`/products/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            disabled={p.draft}
                            title={p.draft ? t('Publish to view') : `/products/${p.slug}`}
                        >{t('View')}</Button>
                    ) : null}
                    <Button size="small" icon={<EyeOutlined/>} onClick={() => vm.togglePublish(p)}>
                        {p.draft ? t('Publish') : t('Unpublish')}
                    </Button>
                    <Popconfirm
                        title={t('Delete product?')}
                        onConfirm={() => vm.remove(p)}
                        okText={t('Delete')}
                        okButtonProps={{danger: true}}
                        cancelText={t('Cancel')}
                    >
                        <Button size="small" danger icon={<DeleteOutlined/>}/>
                    </Popconfirm>
                </Space>
            )},
    ], [t, warehouseTooltip, vm]);

    const toolbar = (
        <Input.Search
            placeholder={t('Search title or SKU')}
            value={vm.search}
            onChange={(e) => vm.setSearch(e.target.value)}
            style={{width: 240}}
        />
    );

    const peer = vm.conflict
        ? (vm.conflict.error.currentDoc as {editedBy?: string; editedAt?: string; title?: string} | null)
        : null;

    return (
        <>
            <AdminCrudListModule
                testId="admin-products"
                columns={columns as unknown as ColumnsType<Record<string, unknown>>}
                rows={vm.filtered as unknown as ReadonlyArray<Record<string, unknown>>}
                rowKey="id"
                loading={vm.loading}
                pageSize={20}
                onAdd={vm.openCreate}
                addLabel={t('New product')}
                addTestId="admin-products-create-btn"
                onRefresh={vm.refresh}
                toolbar={toolbar}
                headerExtra={<AuditBadge editedBy={vm.latestAudit.editedBy} editedAt={vm.latestAudit.editedAt}/>}
                rowTestId={(row) => `admin-products-row-${(row as unknown as IProduct).slug}`}
                showEmptyState={!vm.loading && vm.filtered.length === 0 && !vm.search}
                emptyState={{
                    testId: 'products-empty-state',
                    title: t('empty.products.title'),
                    description: t('empty.products.description'),
                    art: 'products',
                    primary: {
                        label: t('empty.products.primary'),
                        onClick: vm.openCreate,
                        testId: 'products-empty-primary-btn',
                    },
                    secondary: onboardingCta(t('empty.cta.guidedSetup'), 'products-empty-secondary-btn'),
                }}
            />
            <Drawer
                open={vm.editing !== null}
                onClose={onClose}
                title={vm.editing?.id ? t('Edit product') : t('New product')}
                width={720}
                destroyOnClose
                extra={<Button data-testid="admin-products-save-btn" type="primary" onClick={onSave} loading={vm.saving}>{t('Save')}</Button>}
            >
                {vm.isWarehouse && (
                    <Typography.Paragraph type="secondary" style={{marginBottom: 12}}>
                        {warehouseTooltip}
                    </Typography.Paragraph>
                )}
                <Form form={form} layout="vertical">
                    <Form.Item name="title" label={t('Title')} rules={[{required: true, message: t('Title is required')}]}>
                        <Input data-testid="admin-products-name-input"/>
                    </Form.Item>
                    <Form.Item name="slug" label={t('Slug')} tooltip={t('Leave blank to auto-generate from the title.')}>
                        <Input placeholder="my-product"/>
                    </Form.Item>
                    <Form.Item name="sku" label={t('SKU')} rules={[{required: true, message: t('SKU is required')}]}>
                        <Input disabled={vm.fieldDisabled('sku' as keyof InProduct)}/>
                    </Form.Item>
                    <Form.Item name="description" label={t('Description (Markdown)')}>
                        <Input.TextArea rows={6}/>
                    </Form.Item>
                    <Space>
                        <Form.Item name="price" label={t('Price (minor units)')} rules={[{required: true, message: t('Price is required')}]}>
                            <InputNumber data-testid="admin-products-price-input" min={0} step={1} disabled={vm.fieldDisabled('price' as keyof InProduct)}/>
                        </Form.Item>
                        <Form.Item name="currency" label={t('Currency')} rules={[{required: true}]}>
                            <Input style={{width: 90}} maxLength={3}/>
                        </Form.Item>
                        <Form.Item name="stock" label={t('Stock')}>
                            <InputNumber data-testid="admin-products-stock-input" min={0} step={1} disabled={vm.fieldDisabled('stock' as keyof InProduct)}/>
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
                        <Input.TextArea data-testid="admin-products-image-input" rows={4} disabled={vm.fieldDisabled('images' as keyof InProduct)} placeholder="https://…"/>
                    </Form.Item>
                    {/* Phase 1.F polish — constrained `<Select>` driven by
                       `productTemplate.list` filtered by category + source +
                       `commerce.defaultProductAudience`. See
                       `TemplatePickerControl.tsx`. */}
                    <Form.Item
                        name="templateId"
                        label={t('Display template')}
                        tooltip={t('Leave blank to use the default (built-in:standard). See Content → Product templates.')}
                    >
                        <TemplatePickerControl
                            category={(vm.editing?.categories ?? [])[0]}
                            source={vm.editing?.source as 'manual' | 'warehouse' | undefined}
                        />
                    </Form.Item>
                    <Form.Item name="draft" label={t('Draft')} valuePropName="checked">
                        <Switch/>
                    </Form.Item>
                </Form>
            </Drawer>
            <AdminConflictModule
                open={!!vm.conflict}
                docKind={t('Product')}
                peerVersion={vm.conflict?.error.currentVersion ?? 0}
                peerEditedBy={peer?.editedBy}
                peerEditedAt={peer?.editedAt}
                onCancel={vm.dismissConflict}
                onTakeTheirs={vm.takeTheirs}
                onKeepMine={async () => {
                    try { await vm.conflict?.retry(); }
                    catch (err) { notifyError(err); vm.dismissConflict(); }
                }}
            />
        </>
    );
};

export default AdminSettingsProducts;
