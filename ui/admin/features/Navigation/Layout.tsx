import React, {useCallback, useEffect, useState} from "react";
import {Alert, Button, Card, Divider, Input, InputNumber, Radio, Space, Switch, Typography, message} from "antd";
import {useTranslation} from "react-i18next";
import SiteFlagsApi from "@services/api/client/SiteFlagsApi";
import AuditBadge from "@admin/shell/AuditBadge";
import {useRefreshView} from "@client/lib/refreshBus";
import ConflictDialog from "@client/lib/ConflictDialog";
import {ConflictError, isConflictError} from "@client/lib/conflict";

const siteFlagsApi = new SiteFlagsApi();

/**
 * Site settings → Layout tab. Switches the public render between the
 * classic tabs layout and a single-page scroll layout where every page
 * becomes an anchored `<section>` on `/`.
 */
const AdminSettingsLayout: React.FC = () => {
    const {t} = useTranslation();
    const [mode, setMode] = useState<'tabs' | 'scroll'>('tabs');
    const [inlineEdit, setInlineEdit] = useState(false);
    const [autoHC, setAutoHC] = useState(false);
    const [selfHostFonts, setSelfHostFonts] = useState(false);
    const [inquiryEnabled, setInquiryEnabled] = useState(true);
    const [inquiryEmail, setInquiryEmail] = useState('');
    const [inquiryEmailDirty, setInquiryEmailDirty] = useState(false);
    const [inquiryMax, setInquiryMax] = useState<number>(3);
    const [inquiryMaxDirty, setInquiryMaxDirty] = useState(false);
    const [inquiryOrigins, setInquiryOrigins] = useState('');
    const [inquiryOriginsDirty, setInquiryOriginsDirty] = useState(false);
    const [inquirySaving, setInquirySaving] = useState(false);
    const [version, setVersion] = useState<number | undefined>(undefined);
    const [loading, setLoading] = useState(false);
    const [audit, setAudit] = useState<{editedBy?: string; editedAt?: string}>({});
    const [conflict, setConflict] = useState<{error: ConflictError<any>; retry: () => Promise<void>} | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const flags = await siteFlagsApi.get();
            setMode((flags as any).layoutMode === 'scroll' ? 'scroll' : 'tabs');
            setInlineEdit(Boolean((flags as any).inlineTranslationEdit));
            setAutoHC(Boolean((flags as any).autoHighContrast));
            setSelfHostFonts(Boolean((flags as any).selfHostFonts));
            setInquiryEnabled((flags as any).inquiryEnabled !== false);
            setInquiryEmail(String((flags as any).inquiryRecipientEmail ?? ''));
            setInquiryEmailDirty(false);
            setInquiryMax(typeof (flags as any).inquiryMaxPerClient === 'number' ? (flags as any).inquiryMaxPerClient : 3);
            setInquiryMaxDirty(false);
            setInquiryOrigins(String((flags as any).inquiryAllowedOrigins ?? ''));
            setInquiryOriginsDirty(false);
            setVersion((flags as any).version);
            setAudit({editedBy: (flags as any).editedBy, editedAt: (flags as any).editedAt});
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);
    useRefreshView(refresh, 'settings');

    const performSave = useCallback(async (patch: Partial<{layoutMode: 'tabs' | 'scroll'; inlineTranslationEdit: boolean; autoHighContrast: boolean; selfHostFonts: boolean; inquiryEnabled: boolean; inquiryRecipientEmail: string; inquiryMaxPerClient: number; inquiryAllowedOrigins: string}>, expectedVersion: number | undefined) => {
        const result = await siteFlagsApi.save(patch as any, expectedVersion);
        if ((result as any).error) { message.error((result as any).error); return false; }
        message.success(t('Saved'));
        if (typeof (result as any).version === 'number') setVersion((result as any).version);
        return true;
    }, [t]);

    const toggleInlineEdit = async (next: boolean) => {
        const prev = inlineEdit;
        setInlineEdit(next);
        try {
            await performSave({inlineTranslationEdit: next}, version);
        } catch (err) {
            if (isConflictError(err)) {
                setConflict({
                    error: err,
                    retry: async () => {
                        try {
                            await performSave({inlineTranslationEdit: next}, err.currentVersion);
                            setConflict(null);
                        } catch (e) { message.error(String((e as Error)?.message ?? e)); setConflict(null); }
                    },
                });
            } else {
                setInlineEdit(prev);
                message.error(String((err as Error)?.message ?? err));
            }
        }
    };

    const toggleAutoHC = async (next: boolean) => {
        const prev = autoHC;
        setAutoHC(next);
        try {
            await performSave({autoHighContrast: next}, version);
        } catch (err) {
            if (isConflictError(err)) {
                setConflict({
                    error: err,
                    retry: async () => {
                        try {
                            await performSave({autoHighContrast: next}, err.currentVersion);
                            setConflict(null);
                        } catch (e) { message.error(String((e as Error)?.message ?? e)); setConflict(null); }
                    },
                });
            } else {
                setAutoHC(prev);
                message.error(String((err as Error)?.message ?? err));
            }
        }
    };

    const toggleSelfHostFonts = async (next: boolean) => {
        const prev = selfHostFonts;
        setSelfHostFonts(next);
        try {
            await performSave({selfHostFonts: next}, version);
        } catch (err) {
            if (isConflictError(err)) {
                setConflict({
                    error: err,
                    retry: async () => {
                        try {
                            await performSave({selfHostFonts: next}, err.currentVersion);
                            setConflict(null);
                        } catch (e) { message.error(String((e as Error)?.message ?? e)); setConflict(null); }
                    },
                });
            } else {
                setSelfHostFonts(prev);
                message.error(String((err as Error)?.message ?? err));
            }
        }
    };

    const toggleInquiryEnabled = async (next: boolean) => {
        const prev = inquiryEnabled;
        setInquiryEnabled(next);
        try {
            await performSave({inquiryEnabled: next}, version);
        } catch (err) {
            if (isConflictError(err)) {
                setConflict({
                    error: err,
                    retry: async () => {
                        try {
                            await performSave({inquiryEnabled: next}, err.currentVersion);
                            setConflict(null);
                        } catch (e) { message.error(String((e as Error)?.message ?? e)); setConflict(null); }
                    },
                });
            } else {
                setInquiryEnabled(prev);
                message.error(String((err as Error)?.message ?? err));
            }
        }
    };

    const saveInquiryEmail = async () => {
        // Light client-side check — server is the source of truth and
        // performs the same regex, but bouncing here saves a round-trip
        // and surfaces the issue inline next to the field.
        const candidate = inquiryEmail.trim();
        if (candidate && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
            message.error(t('Enter a valid email address (or leave empty to reset to default).'));
            return;
        }
        setInquirySaving(true);
        try {
            await performSave({inquiryRecipientEmail: candidate}, version);
            setInquiryEmailDirty(false);
            await refresh();
        } catch (err) {
            if (isConflictError(err)) {
                setConflict({
                    error: err,
                    retry: async () => {
                        try {
                            await performSave({inquiryRecipientEmail: candidate}, err.currentVersion);
                            setInquiryEmailDirty(false);
                            await refresh();
                            setConflict(null);
                        } catch (e) { message.error(String((e as Error)?.message ?? e)); setConflict(null); }
                    },
                });
            } else {
                message.error(String((err as Error)?.message ?? err));
            }
        } finally {
            setInquirySaving(false);
        }
    };

    const saveInquiryMax = async () => {
        const candidate = Math.max(0, Math.min(100, Math.floor(inquiryMax || 0)));
        setInquirySaving(true);
        try {
            await performSave({inquiryMaxPerClient: candidate}, version);
            setInquiryMaxDirty(false);
            await refresh();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            setInquirySaving(false);
        }
    };

    const saveInquiryOrigins = async () => {
        setInquirySaving(true);
        try {
            await performSave({inquiryAllowedOrigins: inquiryOrigins.trim()}, version);
            setInquiryOriginsDirty(false);
            await refresh();
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            setInquirySaving(false);
        }
    };

    const change = async (next: 'tabs' | 'scroll') => {
        const prev = mode;
        setMode(next);
        try {
            await performSave({layoutMode: next}, version);
        } catch (err) {
            if (isConflictError(err)) {
                setConflict({
                    error: err,
                    retry: async () => {
                        try {
                            await performSave({layoutMode: next}, err.currentVersion);
                            setConflict(null);
                        } catch (e) {
                            if (isConflictError(e)) setConflict({error: e, retry: async () => {}});
                            else message.error(String((e as Error)?.message ?? e));
                        }
                    },
                });
            } else {
                setMode(prev);
                message.error(String((err as Error)?.message ?? err));
            }
        }
    };

    return (
        <div style={{padding: 16, maxWidth: 720}}>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 16}}
                message={t('Pick how visitors move between pages. Both modes share the same content — only the render differs.')}
            />
            <div style={{marginBottom: 12}}>
                <AuditBadge editedBy={audit.editedBy} editedAt={audit.editedAt}/>
            </div>
            <Radio.Group value={mode} onChange={e => change(e.target.value)} disabled={loading} style={{width: '100%'}}>
                <Space orientation="vertical" style={{width: '100%'}}>
                    <Card hoverable style={{border: mode === 'tabs' ? '2px solid var(--theme-colorPrimary, #1677ff)' : undefined}}>
                        <Radio value="tabs">
                            <Typography.Text strong>{t('Tabs')}</Typography.Text>
                            <div style={{marginTop: 4}}>
                                <Typography.Text type="secondary">
                                    {t('Classic layout — clicking a nav item loads that page as its own URL.')}
                                </Typography.Text>
                            </div>
                        </Radio>
                    </Card>
                    <Card hoverable style={{border: mode === 'scroll' ? '2px solid var(--theme-colorPrimary, #1677ff)' : undefined}}>
                        <Radio value="scroll">
                            <Typography.Text strong>{t('Single-page scroll')}</Typography.Text>
                            <div style={{marginTop: 4}}>
                                <Typography.Text type="secondary">
                                    {t('All pages stacked on one URL. Clicking a nav item smooth-scrolls to the matching section; hash URLs stay shareable.')}
                                </Typography.Text>
                            </div>
                        </Radio>
                    </Card>
                </Space>
            </Radio.Group>
            <Divider/>
            <Space orientation="vertical" style={{width: '100%'}} size={8}>
                <Typography.Text strong>{t('Inline translation editing')}</Typography.Text>
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {t('When on, editors + admins can Alt-click any translated string on the public site to edit its translation inline. Off by default to avoid hijacking Alt-click elsewhere.')}
                </Typography.Text>
                <Space align="center">
                    <Switch checked={inlineEdit} onChange={toggleInlineEdit} disabled={loading}/>
                    <span>{inlineEdit ? t('On') : t('Off')}</span>
                </Space>
            </Space>
            <Divider/>
            <Space orientation="vertical" style={{width: '100%'}} size={8}>
                <Typography.Text strong>{t('Auto high-contrast theme')}</Typography.Text>
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {t('When on, visitors whose browser reports prefers-contrast: more (or forced-colors: active) get the High contrast theme automatically, regardless of the active site theme.')}
                </Typography.Text>
                <Space align="center">
                    <Switch checked={autoHC} onChange={toggleAutoHC} disabled={loading}/>
                    <span>{autoHC ? t('On') : t('Off')}</span>
                </Space>
            </Space>
            <Divider/>
            <Space orientation="vertical" style={{width: '100%'}} size={8}>
                <Typography.Text strong>{t('Self-host Google Fonts (GDPR)')}</Typography.Text>
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {t('When on, Google Fonts are proxied through /api/fonts so the visitor browser never contacts fonts.googleapis.com or fonts.gstatic.com. Adds one server hop on first load; repeat visits ride the browser cache.')}
                </Typography.Text>
                <Space align="center">
                    <Switch checked={selfHostFonts} onChange={toggleSelfHostFonts} disabled={loading}/>
                    <span>{selfHostFonts ? t('On') : t('Off')}</span>
                </Space>
            </Space>
            <Divider/>
            <Space orientation="vertical" style={{width: '100%'}} size={8}>
                <Typography.Text strong>{t('Contact form ("Send a brief")')}</Typography.Text>
                <Typography.Text type="secondary" style={{fontSize: 12}}>
                    {t('Where the public-site contact form delivers submissions. Leave empty to reset to the default. SMTP credentials live in the server environment (SMTP_HOST / PORT / USER / PASS / MAIL_FROM); rotate them via .env without redeploying this setting.')}
                </Typography.Text>
                <Space align="center">
                    <Switch checked={inquiryEnabled} onChange={toggleInquiryEnabled} disabled={loading}/>
                    <span>{inquiryEnabled ? t('Form accepts submissions') : t('Form disabled (returns 503)')}</span>
                </Space>
                <Typography.Text type="secondary" style={{fontSize: 12}}>{t('Recipient email')}</Typography.Text>
                <Space.Compact style={{width: '100%', maxWidth: 480}}>
                    <Input
                        type="email"
                        placeholder="recipient@example.com"
                        value={inquiryEmail}
                        onChange={(e) => { setInquiryEmail(e.target.value); setInquiryEmailDirty(true); }}
                        disabled={loading || inquirySaving}
                        onPressEnter={() => { if (inquiryEmailDirty) void saveInquiryEmail(); }}
                    />
                    <Button
                        type="primary"
                        loading={inquirySaving}
                        disabled={!inquiryEmailDirty}
                        onClick={() => void saveInquiryEmail()}
                    >
                        {t('Save')}
                    </Button>
                </Space.Compact>

                <Typography.Text type="secondary" style={{fontSize: 12, marginTop: 4}}>
                    {t('Max messages per visitor IP (lifetime). 0 = no cap. The per-window rate-limit (3/5min) still applies.')}
                </Typography.Text>
                <Space.Compact style={{width: '100%', maxWidth: 240}}>
                    <InputNumber
                        min={0}
                        max={100}
                        value={inquiryMax}
                        onChange={(v) => { setInquiryMax(Number(v ?? 0)); setInquiryMaxDirty(true); }}
                        disabled={loading || inquirySaving}
                        style={{flex: 1}}
                    />
                    <Button
                        type="primary"
                        loading={inquirySaving}
                        disabled={!inquiryMaxDirty}
                        onClick={() => void saveInquiryMax()}
                    >
                        {t('Save')}
                    </Button>
                </Space.Compact>

                <Typography.Text type="secondary" style={{fontSize: 12, marginTop: 4}}>
                    {t('Allowed origins (comma-separated). Empty = same-origin only. Use full URLs (e.g. https://funisimo.pro,https://www.funisimo.pro) to lock submissions to a canonical domain when one image runs across multiple deployments.')}
                </Typography.Text>
                <Space.Compact style={{width: '100%', maxWidth: 600}}>
                    <Input
                        placeholder="https://funisimo.pro,https://www.funisimo.pro"
                        value={inquiryOrigins}
                        onChange={(e) => { setInquiryOrigins(e.target.value); setInquiryOriginsDirty(true); }}
                        disabled={loading || inquirySaving}
                        onPressEnter={() => { if (inquiryOriginsDirty) void saveInquiryOrigins(); }}
                    />
                    <Button
                        type="primary"
                        loading={inquirySaving}
                        disabled={!inquiryOriginsDirty}
                        onClick={() => void saveInquiryOrigins()}
                    >
                        {t('Save')}
                    </Button>
                </Space.Compact>
            </Space>
            {conflict && (() => {
                const peer = conflict.error.currentDoc as {editedBy?: string; editedAt?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('Layout')}
                        peerVersion={conflict.error.currentVersion}
                        peerEditedBy={peer?.editedBy}
                        peerEditedAt={peer?.editedAt}
                        onCancel={() => setConflict(null)}
                        onTakeTheirs={async () => { setConflict(null); await refresh(); }}
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

export default AdminSettingsLayout;
