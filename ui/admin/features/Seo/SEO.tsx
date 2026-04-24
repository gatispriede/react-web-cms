import React, {useCallback, useEffect, useState} from "react";
import {Alert, Button, Col, Input, Row, Space, Typography, message} from "antd";
import {useTranslation} from "react-i18next";
import ImageUrlInput from "@client/lib/ImageUrlInput";
import SiteSeoApi from "@services/api/client/SiteSeoApi";
import {DEFAULT_SITE_SEO, ISiteSeoDefaults} from "@interfaces/ISiteSeo";
import AuditBadge from "@admin/shell/AuditBadge";
import {useRefreshView} from "@client/lib/refreshBus";
import ConflictDialog from "@client/lib/ConflictDialog";
import {ConflictError, isConflictError} from "@client/lib/conflict";

const seoApi = new SiteSeoApi();

const AdminSettingsSEO: React.FC = () => {
    const {t} = useTranslation();
    const [seo, setSeo] = useState<ISiteSeoDefaults>({...DEFAULT_SITE_SEO});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [conflict, setConflict] = useState<{error: ConflictError<any>; retry: () => Promise<void>} | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try { setSeo(await seoApi.get()); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);
    useRefreshView(refresh, 'settings');

    const update = (patch: Partial<ISiteSeoDefaults>) => setSeo(s => ({...s, ...patch}));

    const performSave = useCallback(async (payload: ISiteSeoDefaults, expectedVersion: number | undefined) => {
        const result = await seoApi.save(payload, expectedVersion);
        if ((result as any).error) { message.error((result as any).error); return false; }
        message.success(t('SEO defaults saved'));
        if (typeof (result as any).version === 'number') {
            setSeo(s => ({...s, version: (result as any).version}));
        }
        return true;
    }, [t]);

    const save = async () => {
        setSaving(true);
        try {
            await performSave(seo, seo.version);
        } catch (err) {
            if (isConflictError(err)) {
                setConflict({
                    error: err,
                    retry: async () => {
                        setSaving(true);
                        try {
                            await performSave(seo, err.currentVersion);
                            setConflict(null);
                        } finally { setSaving(false); }
                    },
                });
            } else {
                message.error(String((err as Error)?.message ?? err));
            }
        } finally { setSaving(false); }
    };

    return (
        <div style={{padding: 16, maxWidth: 720}}>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 16}}
                message={t('These defaults are used when a page has no per-page SEO set. Per-page SEO (Navigation > page > SEO) always wins.')}
            />
            <Row gutter={[12, 12]}>
                <Col xs={24}>
                    <Typography.Text strong>{t('Site name')}</Typography.Text>
                    <Input
                        value={seo.siteName ?? ''}
                        onChange={e => update({siteName: e.target.value})}
                        placeholder="Acme Co."
                    />
                </Col>
                <Col xs={24}>
                    <Typography.Text strong>{t('Primary domain')}</Typography.Text>
                    <Input
                        value={seo.primaryDomain ?? ''}
                        onChange={e => update({primaryDomain: e.target.value})}
                        placeholder="https://example.com"
                    />
                </Col>
                <Col xs={24}>
                    <Typography.Text strong>{t('Default description')}</Typography.Text>
                    <Input.TextArea
                        value={seo.defaultDescription ?? ''}
                        onChange={e => update({defaultDescription: e.target.value})}
                        rows={3}
                        maxLength={500}
                        showCount
                    />
                </Col>
                <Col xs={24} md={12}>
                    <Typography.Text strong>{t('Default keywords')}</Typography.Text>
                    <Input
                        value={seo.defaultKeywords ?? ''}
                        onChange={e => update({defaultKeywords: e.target.value})}
                        placeholder="react, next.js, cms"
                    />
                </Col>
                <Col xs={24} md={12}>
                    <Typography.Text strong>{t('Default author')}</Typography.Text>
                    <Input
                        value={seo.defaultAuthor ?? ''}
                        onChange={e => update({defaultAuthor: e.target.value})}
                    />
                </Col>
                <Col xs={24} md={12}>
                    <Typography.Text strong>{t('Default og:image URL')}</Typography.Text>
                    <ImageUrlInput
                        t={t}
                        value={seo.defaultImage ?? ''}
                        onChange={v => update({defaultImage: v})}
                        placeholder="api/og-default.png or https://…"
                    />
                </Col>
                <Col xs={24} md={6}>
                    <Typography.Text strong>{t('Twitter handle')}</Typography.Text>
                    <Input
                        value={seo.twitterHandle ?? ''}
                        onChange={e => update({twitterHandle: e.target.value})}
                        placeholder="@example"
                    />
                </Col>
                <Col xs={24} md={6}>
                    <Typography.Text strong>{t('Default locale')}</Typography.Text>
                    <Input
                        value={seo.defaultLocale ?? ''}
                        onChange={e => update({defaultLocale: e.target.value})}
                        placeholder="en_US"
                    />
                </Col>
            </Row>
            <Space style={{marginTop: 24}} align="center">
                <Button type="primary" onClick={save} loading={saving}>{t('Save')}</Button>
                <Button onClick={refresh} loading={loading}>{t('Refresh')}</Button>
                <AuditBadge editedBy={seo.editedBy} editedAt={seo.editedAt}/>
            </Space>
            {conflict && (() => {
                const peer = conflict.error.currentDoc as {editedBy?: string; editedAt?: string} | null;
                return (
                    <ConflictDialog
                        open
                        docKind={t('SEO defaults')}
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

export default AdminSettingsSEO;
