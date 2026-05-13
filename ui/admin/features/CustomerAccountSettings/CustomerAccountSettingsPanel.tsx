import React, {useEffect} from 'react';
import {Alert, Card, Radio, Skeleton, Space, Switch} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {ALL_ADMIN_TABS, CustomerAccountSettingsViewModel, type AccountTab} from './CustomerAccountSettingsViewModel';

/**
 * Admin pane (Phase 1.E client-account-settings-page):
 *
 *   - Master "Enable customer account settings page" Switch
 *     (defaults on when `auth.clientLoginEnabled` is on).
 *   - Per-tab hide toggles (operators hide irrelevant tabs).
 *   - Default customer type radio (`client` / `company` / `ask`).
 *
 * VM4 — no `useState`. MCP-routed via `site.get-flag` /
 * `site.set-flag` so the admin and the agent share the surface.
 */
const TAB_LABELS: Record<AccountTab, string> = {
    profile: 'Profile',
    security: 'Security',
    addresses: 'Addresses',
    payment: 'Payment methods',
    notifications: 'Notifications',
    privacy: 'Privacy',
    language: 'Language',
};

export const CustomerAccountSettingsPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new CustomerAccountSettingsViewModel());
    useEffect(() => { void vm.refresh(); }, [vm]);

    if (vm.loading) return <Skeleton active/>;
    if (vm.error) return <Alert type="error" message={vm.error}/>;

    return (
        <Card title={t('accountSettings.adminTitle', {defaultValue: 'Customer account settings'}) as string} data-testid="admin-account-settings">
            <Space direction="vertical" size="middle" style={{width: '100%'}}>
                <div>
                    <strong>{t('accountSettings.masterToggle', {defaultValue: 'Enable customer account settings page'}) as string}</strong>
                    <div style={{marginTop: 8}}>
                        <Switch
                            checked={vm.enabled}
                            onChange={(v) => void vm.setEnabled(v)}
                            data-testid="admin-account-settings-enabled"
                        />
                    </div>
                </div>
                <div>
                    <strong>{t('accountSettings.defaultType', {defaultValue: 'Default customer type at signup'}) as string}</strong>
                    <div style={{marginTop: 8}}>
                        <Radio.Group
                            value={vm.defaultType}
                            onChange={(e) => void vm.setDefaultType(e.target.value)}
                            data-testid="admin-account-default-type"
                        >
                            <Radio value="client" data-testid="admin-account-default-type-client">Client (recommended)</Radio>
                            <Radio value="company" data-testid="admin-account-default-type-company">Company</Radio>
                            <Radio value="ask" data-testid="admin-account-default-type-ask">Ask the user</Radio>
                        </Radio.Group>
                    </div>
                </div>
                <div>
                    <strong>{t('accountSettings.hiddenTabs', {defaultValue: 'Hidden tabs'}) as string}</strong>
                    <div style={{marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6}}>
                        {ALL_ADMIN_TABS.map(tab => (
                            <label key={tab} style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                <Switch
                                    checked={vm.hiddenTabs.includes(tab)}
                                    onChange={(v) => void vm.toggleTab(tab, v)}
                                    data-testid={`admin-account-tab-hidden-${tab}`}
                                />
                                <span>{TAB_LABELS[tab]}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </Space>
        </Card>
    );
};

export default CustomerAccountSettingsPanel;
