import React, {useCallback, useEffect, useState} from "react";
import {Alert, Card, Divider, Radio, Space, Switch, Typography, message} from "antd";
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
            setVersion((flags as any).version);
            setAudit({editedBy: (flags as any).editedBy, editedAt: (flags as any).editedAt});
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);
    useRefreshView(refresh, 'settings');

    const performSave = useCallback(async (patch: Partial<{layoutMode: 'tabs' | 'scroll'; inlineTranslationEdit: boolean; autoHighContrast: boolean; selfHostFonts: boolean}>, expectedVersion: number | undefined) => {
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
