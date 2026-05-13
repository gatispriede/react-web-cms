import React, {useEffect} from 'react';
import {Alert, Button, Space, Switch, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import AuditBadge from '@admin/shell/AuditBadge';
import {useRefreshView} from '@client/lib/refreshBus';
import {useViewModel} from '@client/lib/state/observable';
import {CommerceViewModel} from './CommerceViewModel';

/**
 * Commerce settings admin pane (Phase 1.B sub-jump B master switch).
 * Renders `commerce.checkoutEnabled` only — payment-provider sub-toggles
 * + flow shape + shipping methods land in sub-jump C.
 */
const CommerceSettings: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new CommerceViewModel(undefined, t));

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    return (
        <div style={{padding: 16, maxWidth: 720}}>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 16}}
                message={t('Master switch for storefront commerce. When off, /checkout/* 404s, cart drawer is hidden, and Product modules render catalogue-only.')}
            />

            <div style={{marginBottom: 12}}>
                <AuditBadge editedBy={vm.audit.editedBy} editedAt={vm.audit.editedAt}/>
            </div>

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

                <Space>
                    <Button
                        type="primary"
                        data-testid="commerce-save-btn"
                        loading={vm.saving}
                        disabled={vm.loading}
                        onClick={vm.save}
                    >
                        {t('Save')}
                    </Button>
                    <Button
                        data-testid="commerce-refresh-btn"
                        loading={vm.loading}
                        onClick={vm.refresh}
                    >
                        {t('Refresh')}
                    </Button>
                </Space>
            </Space>
        </div>
    );
};

export default CommerceSettings;
