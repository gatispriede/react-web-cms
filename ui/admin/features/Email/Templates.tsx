import React, {useEffect}                                  from 'react';
import {Button, Card, Input, List, Space, Tag, Typography} from 'antd';
import {useTranslation}                                    from 'react-i18next';
import {useViewModel}                                      from '@client/lib/state/observable';
import {TemplatesViewModel}                                from './TemplatesViewModel';

/**
 * W6a — Admin email-template preview pane (`/admin/system/email-templates`).
 *
 * Lists every registered template, mounts the rendered HTML in a sandboxed
 * `<iframe srcDoc>` so styles can't leak into the admin chrome, and
 * exposes a send-test button per template (uses the same `/api/email/test`
 * surface as the existing config pane — verifies deliverability against
 * the active provider).
 */
const Templates: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new TemplatesViewModel());

    useEffect(() => { void vm.loadPreview(); }, [vm, vm.selectedId]);

    return (
        <div style={{padding: 16, maxWidth: 1200}}>
            <Typography.Title level={3} style={{marginTop: 0}}>
                {t('emailTemplates.title')}
            </Typography.Title>
            <Typography.Paragraph type="secondary">
                {t('emailTemplates.intro')}
            </Typography.Paragraph>

            <div style={{display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) 1fr', gap: 16}} data-testid="email-templates-grid">
                <Card size="small" title={t('emailTemplates.list')}>
                    <List
                        size="small"
                        dataSource={vm.templates}
                        data-testid="email-templates-list"
                        renderItem={(tpl) => (
                            <List.Item
                                onClick={() => vm.select(tpl.id)}
                                data-testid={`email-template-row-${tpl.id}`}
                                style={{
                                    cursor: 'pointer',
                                    background: vm.selectedId === tpl.id ? 'var(--ant-color-fill-secondary, #f5f5f5)' : 'transparent',
                                    padding: '8px 12px',
                                    borderRadius: 6,
                                }}
                            >
                                <Space direction="vertical" size={2} style={{width: '100%'}}>
                                    <strong>{tpl.id}</strong>
                                    <span style={{fontSize: 12, opacity: 0.6}}>
                                        {tpl.requiredFields.join(', ')}
                                    </span>
                                </Space>
                            </List.Item>
                        )}
                    />
                </Card>

                <Card
                    size="small"
                    title={
                        <Space>
                            <span>{t('emailTemplates.preview')}</span>
                            {vm.preview?.subject && <Tag>{vm.preview.subject}</Tag>}
                        </Space>
                    }
                    loading={vm.loading}
                    extra={
                        <Button
                            data-testid="email-template-refresh"
                            size="small"
                            onClick={() => void vm.loadPreview()}
                        >
                            {t('emailTemplates.refresh')}
                        </Button>
                    }
                >
                    {vm.previewError ? (
                        <Typography.Text type="danger" data-testid="email-template-preview-error">
                            {vm.previewError}
                        </Typography.Text>
                    ) : vm.preview ? (
                        <iframe
                            data-testid="email-template-preview-iframe"
                            title={`Preview ${vm.preview.templateId}`}
                            srcDoc={vm.preview.html}
                            sandbox=""
                            style={{
                                width: '100%',
                                minHeight: 640,
                                border: '1px solid var(--ant-color-border, #e5e7eb)',
                                borderRadius: 8,
                                background: '#fff',
                            }}
                        />
                    ) : (
                        <Typography.Text type="secondary">
                            {t('emailTemplates.empty')}
                        </Typography.Text>
                    )}

                    <div style={{marginTop: 16}}>
                        <Space.Compact style={{width: '100%', maxWidth: 520}}>
                            <Input
                                data-testid="email-template-test-recipient"
                                placeholder="you@example.com"
                                value={vm.testRecipient}
                                onChange={(e) => vm.setTestRecipient(e.target.value)}
                            />
                            <Button
                                data-testid="email-template-send-test"
                                type="primary"
                                loading={vm.sending}
                                onClick={() => void vm.sendTest()}
                            >
                                {t('emailTemplates.sendTest')}
                            </Button>
                        </Space.Compact>
                        <Typography.Paragraph type="secondary" style={{marginTop: 8, fontSize: 12}}>
                            {t('emailTemplates.sendTestHint')}
                        </Typography.Paragraph>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Templates;
