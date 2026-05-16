/**
 * admin-module-composed — Commerce settings bridge.
 *
 * Was a bespoke hand-coded pane; now the `AdminLoader` *bridge* for
 * `client-config/commerce`. `CommerceViewModel` + the bespoke
 * `checkoutEnabled` switch stay unchanged ("admin stays mostly same");
 * only the surrounding chrome moves into the generic `AdminFormModule`
 * shape — AuditBadge → `headerExtra`, Save → `onSave`, Refresh →
 * `footerExtra`.
 *
 * Registered with the `AdminPageRegistry` by `CommerceAdminLoader`; the
 * shell reaches it via `AdminPageDispatch` (see `CommerceAdminUILoader`).
 */
import React, {useEffect} from 'react';
import {Alert, Button, Space, Switch, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import AuditBadge from '@admin/shell/AuditBadge';
import {useRefreshView} from '@client/lib/useRefreshView';
import {useViewModel} from '@client/lib/state/observable';
import AdminFormModule from '@admin/modules/shapes/AdminFormModule';
import {CommerceViewModel} from './CommerceViewModel';

const CommerceSettings: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new CommerceViewModel(undefined, t));

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    return (
        <AdminFormModule
            testId="admin-commerce"
            title={t('Commerce')}
            headerExtra={<AuditBadge editedBy={vm.audit.editedBy} editedAt={vm.audit.editedAt}/>}
            onSave={vm.save}
            saveLabel={t('Save')}
            saveTestId="commerce-save-btn"
            saving={vm.saving}
            saveDisabled={vm.loading}
            footerExtra={
                <Button
                    data-testid="commerce-refresh-btn"
                    loading={vm.loading}
                    onClick={vm.refresh}
                >
                    {t('Refresh')}
                </Button>
            }
        >
            <div style={{maxWidth: 720}}>
                <Alert
                    type="info"
                    showIcon
                    style={{marginBottom: 16}}
                    message={t('Master switch for storefront commerce. When off, /checkout/* 404s, cart drawer is hidden, and Product modules render catalogue-only.')}
                />

                <Space direction="vertical" size={16} style={{width: '100%'}}>
                    <div>
                        <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
                            <Switch
                                data-testid="commerce-checkoutenabled-switch"
                                checked={vm.state.checkoutEnabled}
                                onChange={(v) => vm.setCheckoutEnabled(v)}
                            />
                            <Typography.Text strong>{t('Enable checkout on this site')}</Typography.Text>
                        </label>
                        <Typography.Text type="secondary" style={{fontSize: 12, display: 'block', marginTop: 6}}>
                            {t('When enabled, customers can add products to cart and complete checkout. Per-payment-provider toggles and flow customisation land in a follow-up.')}
                        </Typography.Text>
                    </div>
                </Space>
            </div>
        </AdminFormModule>
    );
};

export default CommerceSettings;
