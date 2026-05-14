/**
 * admin-module-composed — SEO defaults bridge.
 *
 * Was a bespoke hand-coded pane; now the `AdminLoader` *bridge* for
 * `seo`. `SEOViewModel` is unchanged ("admin stays mostly same") —
 * only the surrounding chrome moves into the generic `AdminFormModule`
 * shape. The `AuditBadge` becomes `headerExtra`; Save maps onto
 * `onSave`; Refresh stays bespoke in `footerExtra`. The intro `Alert`
 * + the `ConflictDialog` stay bespoke in the form body.
 *
 * Registered with the `AdminPageRegistry` by `SeoAdminLoader`; the
 * shell reaches it via `AdminPageDispatch` (see `SeoAdminUILoader`).
 */
import React, {useEffect} from "react";
import {Alert, Button, Col, Input, Row, Typography} from "antd";
import {notifyError} from '@admin/lib/notify';
import {useTranslation} from "react-i18next";
import ImageUrlInput from "@client/lib/ImageUrlInput";
import AuditBadge from "@admin/shell/AuditBadge";
import {useRefreshView} from "@client/lib/refreshBus";
import ConflictDialog from "@client/lib/ConflictDialog";
import {useViewModel} from "@client/lib/state/observable";
import AdminFormModule from "@admin/modules/shapes/AdminFormModule";
import {SEOViewModel} from "./SEOViewModel";

const AdminSettingsSEO: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new SEOViewModel(undefined, t));

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(() => void vm.refresh(), 'settings');

    const seo = vm.seo;

    return (
        <AdminFormModule
            testId="admin-seo"
            title={t('SEO defaults')}
            headerExtra={<AuditBadge editedBy={seo.editedBy} editedAt={seo.editedAt}/>}
            onSave={() => void vm.save()}
            saveLabel={t('Save')}
            saveTestId="seo-save-button"
            saving={vm.saving}
            footerExtra={
                <Button data-testid="seo-refresh-button" onClick={() => void vm.refresh()} loading={vm.loading}>{t('Refresh')}</Button>
            }
        >
            <div style={{maxWidth: 720}}>
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
                            data-testid="seo-site-name-input"
                            value={seo.siteName ?? ''}
                            onChange={e => vm.update({siteName: e.target.value})}
                            placeholder="Acme Co."
                        />
                    </Col>
                    <Col xs={24}>
                        <Typography.Text strong>{t('Primary domain')}</Typography.Text>
                        <Input
                            data-testid="seo-primary-domain-input"
                            value={seo.primaryDomain ?? ''}
                            onChange={e => vm.update({primaryDomain: e.target.value})}
                            placeholder="https://example.com"
                        />
                    </Col>
                    <Col xs={24}>
                        <Typography.Text strong>{t('Default description')}</Typography.Text>
                        <Input.TextArea
                            data-testid="seo-default-description-textarea"
                            value={seo.defaultDescription ?? ''}
                            onChange={e => vm.update({defaultDescription: e.target.value})}
                            rows={3}
                            maxLength={500}
                            showCount
                        />
                    </Col>
                    <Col xs={24} md={12}>
                        <Typography.Text strong>{t('Default keywords')}</Typography.Text>
                        <Input
                            data-testid="seo-default-keywords-input"
                            value={seo.defaultKeywords ?? ''}
                            onChange={e => vm.update({defaultKeywords: e.target.value})}
                            placeholder="react, next.js, cms"
                        />
                    </Col>
                    <Col xs={24} md={12}>
                        <Typography.Text strong>{t('Default author')}</Typography.Text>
                        <Input
                            data-testid="seo-default-author-input"
                            value={seo.defaultAuthor ?? ''}
                            onChange={e => vm.update({defaultAuthor: e.target.value})}
                        />
                    </Col>
                    <Col xs={24} md={12}>
                        <Typography.Text strong>{t('Default og:image URL')}</Typography.Text>
                        <ImageUrlInput
                            t={t}
                            value={seo.defaultImage ?? ''}
                            onChange={v => vm.update({defaultImage: v})}
                            placeholder="api/og-default.png or https://…"
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Typography.Text strong>{t('Twitter handle')}</Typography.Text>
                        <Input
                            data-testid="seo-twitter-handle-input"
                            value={seo.twitterHandle ?? ''}
                            onChange={e => vm.update({twitterHandle: e.target.value})}
                            placeholder="@example"
                        />
                    </Col>
                    <Col xs={24} md={6}>
                        <Typography.Text strong>{t('Default locale')}</Typography.Text>
                        <Input
                            data-testid="seo-default-locale-input"
                            value={seo.defaultLocale ?? ''}
                            onChange={e => vm.update({defaultLocale: e.target.value})}
                            placeholder="en_US"
                        />
                    </Col>
                </Row>
                {vm.conflict && (() => {
                    const c = vm.conflict;
                    const peer = c.error.currentDoc as {editedBy?: string; editedAt?: string} | null;
                    return (
                        <ConflictDialog
                            open
                            docKind={t('SEO defaults')}
                            peerVersion={c.error.currentVersion}
                            peerEditedBy={peer?.editedBy}
                            peerEditedAt={peer?.editedAt}
                            onCancel={vm.dismissConflict}
                            onTakeTheirs={async () => { vm.dismissConflict(); await vm.refresh(); }}
                            onKeepMine={async () => {
                                try { await c.retry(); }
                                catch (err) { notifyError(err); vm.dismissConflict(); }
                            }}
                        />
                    );
                })()}
            </div>
        </AdminFormModule>
    );
};

export default AdminSettingsSEO;
