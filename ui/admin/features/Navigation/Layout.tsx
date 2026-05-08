import React, {useEffect} from "react";
import {Alert, Button, Card, Divider, Input, InputNumber, Radio, Space, Switch, Typography, message} from "antd";
import {useTranslation} from "react-i18next";
import AuditBadge from "@admin/shell/AuditBadge";
import {useRefreshView} from "@client/lib/refreshBus";
import ConflictDialog from "@client/lib/ConflictDialog";
import {useViewModel} from "@client/lib/state/observable";
import {LayoutViewModel} from "./LayoutViewModel";
import {useAdminMode} from "@admin/lib/adminMode";

/** Render-only Site Layout pane — VM3 (2026-05-02). */
const AdminSettingsLayout: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new LayoutViewModel(undefined, t));
    const {mode: adminMode} = useAdminMode();
    const simplified = adminMode === 'simplified';

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    return (
        <div style={{padding: 16, maxWidth: 720}}>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 16}}
                message={t('Pick how visitors move between pages. Both modes share the same content — only the render differs.')}
            />
            <div style={{marginBottom: 12}}>
                <AuditBadge editedBy={vm.audit.editedBy} editedAt={vm.audit.editedAt}/>
            </div>
            <Radio.Group value={vm.mode} onChange={e => vm.setMode(e.target.value)} disabled={vm.loading} style={{width: '100%'}}>
                <Space orientation="vertical" style={{width: '100%'}}>
                    <Card data-testid="site-layout-mode-tabs-card" hoverable style={{border: vm.mode === 'tabs' ? '2px solid var(--theme-colorPrimary, #1677ff)' : undefined}}>
                        <Radio data-testid="site-layout-mode-tabs-radio" value="tabs">
                            <Typography.Text strong>{t('Tabs')}</Typography.Text>
                            <div style={{marginTop: 4}}>
                                <Typography.Text type="secondary">
                                    {t('Classic layout — clicking a nav item loads that page as its own URL.')}
                                </Typography.Text>
                            </div>
                        </Radio>
                    </Card>
                    <Card data-testid="site-layout-mode-scroll-card" hoverable style={{border: vm.mode === 'scroll' ? '2px solid var(--theme-colorPrimary, #1677ff)' : undefined}}>
                        <Radio data-testid="site-layout-mode-scroll-radio" value="scroll">
                            <Typography.Text strong>{t('Single-page scroll')}</Typography.Text>
                            <div style={{marginTop: 4}}>
                                <Typography.Text type="secondary">
                                    {t('All pages stacked on one URL. Clicking a nav item smooth-scrolls to the matching section; hash URLs stay shareable.')}
                                </Typography.Text>
                            </div>
                        </Radio>
                    </Card>
                    <Card data-testid="site-layout-mode-auto-card" hoverable style={{border: vm.mode === 'auto' ? '2px solid var(--theme-colorPrimary, #1677ff)' : undefined}}>
                        <Radio data-testid="site-layout-mode-auto-radio" value="auto">
                            <Typography.Text strong>{t('Auto')}</Typography.Text>
                            <div style={{marginTop: 4}}>
                                <Typography.Text type="secondary">
                                    {t('Defer to the safe default (currently: Tabs). Pick this when the site has no strong preference and the operator wants the platform to choose.')}
                                </Typography.Text>
                            </div>
                        </Radio>
                    </Card>
                </Space>
            </Radio.Group>
            {/* Simplified-mode authors only pick a layout mode. Inline
                translation, auto high-contrast, GDPR fonts, and the
                contact-form configuration are advanced surfaces. */}
            {!simplified && <>
            <Divider/>
            <Space orientation="vertical" style={{width: '100%'}} size={8}>
                <Typography.Text strong>{t('Inline translation editing')}</Typography.Text>
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {t('When on, editors + admins can Alt-click any translated string on the public site to edit its translation inline. Off by default to avoid hijacking Alt-click elsewhere.')}
                </Typography.Text>
                <Space align="center">
                    <Switch checked={vm.inlineEdit} onChange={vm.setInlineEdit} disabled={vm.loading}/>
                    <span>{vm.inlineEdit ? t('On') : t('Off')}</span>
                </Space>
            </Space>
            <Divider/>
            <Space orientation="vertical" style={{width: '100%'}} size={8}>
                <Typography.Text strong>{t('Auto high-contrast theme')}</Typography.Text>
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {t('When on, visitors whose browser reports prefers-contrast: more (or forced-colors: active) get the High contrast theme automatically, regardless of the active site theme.')}
                </Typography.Text>
                <Space align="center">
                    <Switch checked={vm.autoHC} onChange={vm.setAutoHC} disabled={vm.loading}/>
                    <span>{vm.autoHC ? t('On') : t('Off')}</span>
                </Space>
            </Space>
            <Divider/>
            <Space orientation="vertical" style={{width: '100%'}} size={8}>
                <Typography.Text strong>{t('Self-host Google Fonts (GDPR)')}</Typography.Text>
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {t('When on, Google Fonts are proxied through /api/fonts so the visitor browser never contacts fonts.googleapis.com or fonts.gstatic.com. Adds one server hop on first load; repeat visits ride the browser cache.')}
                </Typography.Text>
                <Space align="center">
                    <Switch checked={vm.selfHostFonts} onChange={vm.setSelfHostFonts} disabled={vm.loading}/>
                    <span>{vm.selfHostFonts ? t('On') : t('Off')}</span>
                </Space>
            </Space>
            <Divider/>
            <Space orientation="vertical" style={{width: '100%'}} size={8}>
                <Typography.Text strong>{t('Contact form ("Send a brief")')}</Typography.Text>
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {t('Where the public-site contact form delivers submissions. Leave empty to reset to the default. SMTP credentials live in the server environment (SMTP_HOST / PORT / USER / PASS / MAIL_FROM); rotate them via .env without redeploying this setting.')}
                </Typography.Text>
                <Space align="center">
                    <Switch checked={vm.inquiryEnabled} onChange={vm.setInquiryEnabled} disabled={vm.loading}/>
                    <span>{vm.inquiryEnabled ? t('Form accepts submissions') : t('Form disabled (returns 503)')}</span>
                </Space>
                <Typography.Text type="secondary" style={{fontSize: 12}}>{t('Recipient email')}</Typography.Text>
                <Space.Compact style={{width: '100%', maxWidth: 480}}>
                    <Input
                        type="email"
                        placeholder="recipient@example.com"
                        value={vm.inquiryEmail}
                        onChange={(e) => vm.setInquiryEmail(e.target.value)}
                        disabled={vm.loading || vm.inquirySaving}
                        onPressEnter={() => { if (vm.inquiryEmailDirty) void vm.saveInquiryEmail(); }}
                    />
                    <Button
                        type="primary"
                        loading={vm.inquirySaving}
                        disabled={!vm.inquiryEmailDirty}
                        onClick={() => void vm.saveInquiryEmail()}
                    >{t('Save')}</Button>
                </Space.Compact>

                <Typography.Text type="secondary" style={{fontSize: 12, marginTop: 4}}>
                    {t('Max messages per visitor IP (lifetime). 0 = no cap. The per-window rate-limit (3/5min) still applies.')}
                </Typography.Text>
                <Space.Compact style={{width: '100%', maxWidth: 240}}>
                    <InputNumber
                        min={0}
                        max={100}
                        value={vm.inquiryMax}
                        onChange={(v) => vm.setInquiryMax(Number(v ?? 0))}
                        disabled={vm.loading || vm.inquirySaving}
                        style={{flex: 1}}
                    />
                    <Button
                        type="primary"
                        loading={vm.inquirySaving}
                        disabled={!vm.inquiryMaxDirty}
                        onClick={() => void vm.saveInquiryMax()}
                    >{t('Save')}</Button>
                </Space.Compact>

                <Typography.Text type="secondary" style={{fontSize: 12, marginTop: 4}}>
                    {t('Allowed origins (comma-separated). Empty = same-origin only. Use full URLs (e.g. https://funisimo.pro,https://www.funisimo.pro) to lock submissions to a canonical domain when one image runs across multiple deployments.')}
                </Typography.Text>
                <Space.Compact style={{width: '100%', maxWidth: 600}}>
                    <Input
                        placeholder="https://funisimo.pro,https://www.funisimo.pro"
                        value={vm.inquiryOrigins}
                        onChange={(e) => vm.setInquiryOrigins(e.target.value)}
                        disabled={vm.loading || vm.inquirySaving}
                        onPressEnter={() => { if (vm.inquiryOriginsDirty) void vm.saveInquiryOrigins(); }}
                    />
                    <Button
                        type="primary"
                        loading={vm.inquirySaving}
                        disabled={!vm.inquiryOriginsDirty}
                        onClick={() => void vm.saveInquiryOrigins()}
                    >{t('Save')}</Button>
                </Space.Compact>
            </Space>
            </>}
            {vm.conflict && (() => {
                const peer = vm.conflict.error.currentDoc as {editedBy?: string; editedAt?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Layout')}
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

export default AdminSettingsLayout;
