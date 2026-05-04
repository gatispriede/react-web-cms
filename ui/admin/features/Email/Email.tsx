import React, {useEffect}                from 'react';
import {Button, Card, Form, Input, InputNumber, Select, Space, Tag, Typography} from 'antd';
import {useTranslation}                  from 'react-i18next';
import {useViewModel}                    from '@client/lib/state/observable';
import {EmailViewModel, type EmailProvider} from './EmailViewModel';

/**
 * Admin email-provider config — `/admin/system/email`. Replaces the
 * SMTP-via-env model. Operator picks SMTP / Resend / Disabled, fills
 * provider-specific fields + From + Inquiry recipient, hits Save, then
 * Test-send to verify before going live. Secrets stored encrypted at
 * rest via `services/infra/secretBox.ts` (master key in
 * `process.env.SECRETBOX_KEY`).
 */
const Email: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new EmailViewModel());
    useEffect(() => { void vm.refresh(); }, [vm]);

    return (
        <div style={{padding: 16, maxWidth: 760}}>
            <Typography.Title level={3} style={{marginTop: 0}}>{t('Email provider')}</Typography.Title>
            <Typography.Paragraph type="secondary">
                {t('Configure how the site sends contact-form replies and admin emails. Secrets are encrypted at rest. Set SECRETBOX_KEY in the environment to enable encryption — without it, secrets are stored as plaintext in Mongo (dev convenience only).')}
            </Typography.Paragraph>

            <Card size="small" loading={vm.loading} title={t('Provider')}>
                <Form layout="vertical">
                    <Form.Item label={t('Active provider')}>
                        <Select<EmailProvider>
                            value={vm.draft.provider}
                            onChange={(v) => vm.setProvider(v)}
                            options={[
                                {value: 'disabled', label: t('Disabled (no email)')},
                                {value: 'smtp',     label: t('SMTP')},
                                {value: 'resend',   label: t('Resend')},
                            ]}
                            style={{maxWidth: 260}}
                        />
                    </Form.Item>

                    <Form.Item label={t('From address')} extra={t('Used in the RFC-5322 From header. e.g. "SkyClimber <noreply@skyclimber.pro>"')}>
                        <Input value={vm.draft.from} onChange={e => vm.setFrom(e.target.value)} placeholder="Site Name <noreply@example.com>"/>
                    </Form.Item>

                    <Form.Item label={t('Inquiry recipient')} extra={t('Where contact-form submissions get delivered.')}>
                        <Input value={vm.draft.inquiryRecipient} onChange={e => vm.setRecipient(e.target.value)} placeholder="you@example.com"/>
                    </Form.Item>

                    {vm.draft.provider === 'smtp' && (
                        <>
                            <Form.Item label={t('SMTP host')}>
                                <Input value={vm.draft.smtpHost} onChange={e => vm.setSmtpHost(e.target.value)} placeholder="smtp.gmail.com"/>
                            </Form.Item>
                            <Form.Item label={t('SMTP port')}>
                                <InputNumber min={1} max={65535} value={vm.draft.smtpPort ?? undefined} onChange={v => vm.setSmtpPort(typeof v === 'number' ? v : null)} style={{width: 140}}/>
                            </Form.Item>
                            <Form.Item label={t('SMTP user')}>
                                <Input value={vm.draft.smtpUser} onChange={e => vm.setSmtpUser(e.target.value)}/>
                            </Form.Item>
                            <Form.Item label={t('SMTP password')} extra={!vm.draft.smtpPassDirty && vm.draft.smtpPassDisplay
                                ? t('Stored. Clear and re-type to change.')
                                : t('Encrypted at rest.')}>
                                <Input.Password value={vm.draft.smtpPassDisplay} onChange={e => vm.setSmtpPass(e.target.value)} placeholder={vm.draft.smtpPassDisplay ? '' : t('Enter SMTP password')}/>
                            </Form.Item>
                        </>
                    )}

                    {vm.draft.provider === 'resend' && (
                        <Form.Item label={t('Resend API key')} extra={!vm.draft.resendApiKeyDirty && vm.draft.resendApiKeyDisplay
                            ? t('Stored. Clear and re-type to change.')
                            : t('Get one at resend.com → API Keys. Encrypted at rest.')}>
                            <Input.Password value={vm.draft.resendApiKeyDisplay} onChange={e => vm.setResendKey(e.target.value)} placeholder={vm.draft.resendApiKeyDisplay ? '' : 're_...'}/>
                        </Form.Item>
                    )}

                    <Space>
                        <Button type="primary" loading={vm.saving} onClick={() => void vm.save()}>{t('Save')}</Button>
                        <Button onClick={() => void vm.refresh()}>{t('Reload')}</Button>
                    </Space>
                </Form>
            </Card>

            <Card size="small" title={t('Test send')} style={{marginTop: 16}}>
                <Form layout="vertical">
                    <Form.Item label={t('Send test email to')}>
                        <Input value={vm.testRecipient} onChange={e => vm.setTestRecipient(e.target.value)} placeholder="you@example.com" style={{maxWidth: 320}}/>
                    </Form.Item>
                    <Space>
                        <Button onClick={() => void vm.testSend()} loading={vm.testing} disabled={vm.draft.provider === 'disabled'}>{t('Send test')}</Button>
                        {vm.lastTestResult && (
                            vm.lastTestResult.ok
                                ? <Tag color="green">{t('OK')} · {vm.lastTestResult.provider} · {vm.lastTestResult.durationMs}ms</Tag>
                                : <Tag color="red">{t('Failed')}: {vm.lastTestResult.error}</Tag>
                        )}
                    </Space>
                </Form>
            </Card>
        </div>
    );
};

export default Email;
