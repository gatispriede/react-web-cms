/**
 * Product Templates admin pane — list + simple detail editor.
 * Phase 1.F (product-display-templates).
 *
 * Operators see every template (built-ins first), can pick one to edit
 * its metadata, duplicate any (including built-ins), and delete custom
 * templates (cascade-resets every product referencing it). The section
 * editor is intentionally deferred — operators add sections at the
 * leaf-page level for now; structural template edits land in a
 * follow-up jump.
 */
import React, {useEffect} from 'react';
import {Alert, Button, Empty, Input, List, Popconfirm, Select, Space, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {AUDIENCE_OPTIONS, ProductTemplatesViewModel} from './ProductTemplatesViewModel';
import TemplateSectionEditor from './TemplateSectionEditor';

const ProductTemplatesPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new ProductTemplatesViewModel());
    useEffect(() => { void vm.refresh(); }, [vm]);

    return (
        <Space
            orientation="vertical"
            size="large"
            style={{width: '100%', padding: 16}}
            data-testid="product-templates-pane"
        >
            <Typography.Title level={4} style={{margin: 0}}>
                {t('Product display templates')}
            </Typography.Title>
            <Typography.Paragraph type="secondary">
                {t('Named section compositions you assign to products. Built-ins cannot be deleted — duplicate to customise.')}
            </Typography.Paragraph>

            <Space orientation="vertical" style={{width: '100%'}}>
                <Typography.Text strong>{t('Create custom template')}</Typography.Text>
                <Space.Compact style={{width: '100%', maxWidth: 600}}>
                    <Input
                        data-testid="product-template-create-name"
                        placeholder={t('Template name')}
                        value={vm.createName}
                        onChange={e => vm.setCreateName(e.target.value)}
                    />
                    <Select
                        data-testid="product-template-create-audience"
                        value={vm.createAudience}
                        onChange={vm.setCreateAudience}
                        options={[...AUDIENCE_OPTIONS]}
                        style={{minWidth: 140}}
                    />
                    <Button
                        type="primary"
                        data-testid="product-template-create-submit"
                        loading={vm.saving}
                        onClick={() => void vm.create()}
                    >{t('Create')}</Button>
                </Space.Compact>
            </Space>

            <div style={{display: 'flex', gap: 16, width: '100%'}}>
                <div style={{minWidth: 320, flex: '0 0 320px'}}>
                    <Typography.Text strong>{t('Templates')}</Typography.Text>
                    <List
                        data-testid="product-template-list"
                        size="small"
                        bordered
                        loading={vm.loading}
                        dataSource={vm.list}
                        locale={{emptyText: <Empty description={t('No templates yet')}/>}}
                        renderItem={r => (
                            <List.Item
                                data-testid={`product-template-row-${r.id}`}
                                onClick={() => void vm.select(r.id)}
                                style={{cursor: 'pointer', background: vm.selected?.id === r.id ? '#f5f5f5' : undefined}}
                            >
                                <List.Item.Meta
                                    title={<>
                                        <span>{r.name}</span>{' '}
                                        {r.builtIn && <Tag color="blue">built-in</Tag>}
                                        <Tag>{r.audience}</Tag>
                                    </>}
                                    description={
                                        <>
                                            {r.description}
                                            {typeof r.usageCount === 'number' && (
                                                <div style={{marginTop: 4, fontSize: 12, opacity: 0.7}}>
                                                    {t('Used by {{n}} product(s)', {n: r.usageCount})}
                                                </div>
                                            )}
                                        </>
                                    }
                                />
                            </List.Item>
                        )}
                    />
                </div>

                <div style={{flex: 1}}>
                    {!vm.selected ? (
                        <Empty description={t('Pick a template to edit')}/>
                    ) : (
                        <Space orientation="vertical" style={{width: '100%'}} data-testid="product-template-detail">
                            <Typography.Title level={5} style={{margin: 0}}>
                                {vm.selected.name}{' '}
                                {vm.selected.builtIn && <Tag color="blue">built-in</Tag>}
                            </Typography.Title>
                            <Typography.Text type="secondary" code>{vm.selected.id}</Typography.Text>

                            <label>
                                <div>{t('Name')}</div>
                                <Input
                                    data-testid="product-template-edit-name"
                                    value={vm.editName}
                                    onChange={e => vm.setEditName(e.target.value)}
                                    disabled={vm.selected.builtIn}
                                />
                            </label>
                            <label>
                                <div>{t('Description')}</div>
                                <Input.TextArea
                                    data-testid="product-template-edit-description"
                                    value={vm.editDescription}
                                    onChange={e => vm.setEditDescription(e.target.value)}
                                    rows={3}
                                    disabled={vm.selected.builtIn}
                                />
                            </label>
                            <label>
                                <div>{t('Audience')}</div>
                                <Select
                                    data-testid="product-template-edit-audience"
                                    value={vm.editAudience}
                                    onChange={vm.setEditAudience}
                                    options={[...AUDIENCE_OPTIONS]}
                                    style={{minWidth: 140}}
                                    disabled={vm.selected.builtIn}
                                />
                            </label>

                            <Space>
                                <Button
                                    type="primary"
                                    data-testid="product-template-save"
                                    loading={vm.saving}
                                    disabled={vm.selected.builtIn}
                                    onClick={() => void vm.save()}
                                >{t('Save')}</Button>
                                <Button
                                    data-testid="product-template-duplicate"
                                    onClick={() => void vm.duplicate()}
                                >{t('Duplicate')}</Button>
                                <a
                                    href={`/admin/preview/template/${vm.selected.id}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    data-testid="product-template-preview"
                                >
                                    <Button>{t('Preview')}</Button>
                                </a>
                                <Popconfirm
                                    title={t('Delete this template?')}
                                    description={t('All products using it reset to the default template.')}
                                    okText={t('Delete')}
                                    cancelText={t('Cancel')}
                                    onConfirm={() => void vm.deleteSelected()}
                                    disabled={vm.selected.builtIn}
                                >
                                    <Button
                                        danger
                                        data-testid="product-template-delete"
                                        disabled={vm.selected.builtIn}
                                    >{t('Delete')}</Button>
                                </Popconfirm>
                            </Space>

                            {vm.selected.builtIn ? (
                                <Alert
                                    type="info"
                                    showIcon
                                    style={{marginTop: 12}}
                                    data-testid="template-builtin-banner"
                                    message={t('Built-in template — duplicate to customize')}
                                    action={
                                        <Button
                                            size="small"
                                            data-testid="template-builtin-duplicate"
                                            onClick={() => void vm.duplicate()}
                                        >{t('Duplicate')}</Button>
                                    }
                                />
                            ) : null}

                            <TemplateSectionEditor
                                key={vm.selected.id}
                                sections={vm.selected.sections}
                                readOnly={vm.selected.builtIn}
                                saving={vm.saving}
                                onSave={s => vm.saveSections(s)}
                            />
                        </Space>
                    )}
                </div>
            </div>
        </Space>
    );
};

export default ProductTemplatesPanel;
