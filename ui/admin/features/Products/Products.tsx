import React, {useEffect, useMemo} from "react";
import {Button, Drawer, Form, Input, InputNumber, Popconfirm, Select, Space, Switch, Table, Tag, Tooltip, Typography, message} from "antd";
import {DeleteOutlined, EditOutlined, EyeOutlined, LinkOutlined, PlusOutlined} from "@client/lib/icons";
import {useTranslation} from "react-i18next";
import {IProduct, InProduct} from "@interfaces/IProduct";
import AuditBadge from "@admin/shell/AuditBadge";
import {useRefreshView} from "@client/lib/refreshBus";
import ConflictDialog from "@client/lib/ConflictDialog";
import {useViewModel} from "@client/lib/state/observable";
import {ProductsViewModel} from "./ProductsViewModel";

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
            });
        } else {
            form.setFieldsValue({draft: true, currency: 'EUR', price: 0, stock: 0, categories: [], images: ''});
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

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 16}} align="center" wrap>
                <Button data-testid="admin-products-create-btn" type="primary" icon={<PlusOutlined/>} onClick={vm.openCreate}>{t('New product')}</Button>
                <Button onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
                <Input.Search
                    placeholder={t('Search title or SKU')}
                    value={vm.search}
                    onChange={(e) => vm.setSearch(e.target.value)}
                    style={{width: 240}}
                />
                <AuditBadge editedBy={vm.latestAudit.editedBy} editedAt={vm.latestAudit.editedAt}/>
            </Space>
            <Table
                rowKey="id"
                loading={vm.loading}
                dataSource={vm.filtered}
                columns={columns}
                pagination={{pageSize: 20}}
                size="middle"
                onRow={(p: IProduct) => ({'data-testid': `admin-products-row-${p.slug}`} as any)}
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
                    <Form.Item name="draft" label={t('Draft')} valuePropName="checked">
                        <Switch/>
                    </Form.Item>
                </Form>
            </Drawer>
            {vm.conflict && (() => {
                const peer = vm.conflict.error.currentDoc as {editedBy?: string; editedAt?: string; title?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Product')}
                        peerVersion={vm.conflict.error.currentVersion}
                        peerEditedBy={peer?.editedBy}
                        peerEditedAt={peer?.editedAt}
                        onCancel={vm.dismissConflict}
                        onTakeTheirs={vm.takeTheirs}
                        onKeepMine={async () => {
                            try { await vm.conflict?.retry(); }
                            catch (err) { message.error(String((err as Error)?.message ?? err)); vm.dismissConflict(); }
                        }}
                    />
                );
            })()}
        </div>
    );
};

export default AdminSettingsProducts;
