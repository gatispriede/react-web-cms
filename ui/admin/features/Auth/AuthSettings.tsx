/**
 * admin-module-composed — Auth settings bridge.
 *
 * Was a bespoke hand-coded pane; now the `AdminLoader` *bridge* for
 * `system/auth`. `AuthSettingsViewModel` + the bespoke per-provider
 * toggle rows stay unchanged ("admin stays mostly same"); only the
 * surrounding Card chrome moves into the generic `AdminFormModule`
 * shape. Toggles auto-save via the VM, so the module renders without
 * an `onSave` save bar.
 *
 * Registered with the `AdminPageRegistry` by `AuthAdminLoader`; the
 * shell reaches it via `AdminPageDispatch` (see `AuthAdminUILoader`).
 */
import React, {useEffect} from 'react';
import {Switch, Alert, Skeleton, Tag, Space} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import AdminFormModule from '@admin/modules/shapes/AdminFormModule';
import {AuthSettingsViewModel, type AuthFlagKey} from './AuthSettingsViewModel';

const FLAG_LABELS: Array<{key: AuthFlagKey; labelKey: string; envKey?: string}> = [
    {key: 'clientLoginEnabled', labelKey: 'auth.masterToggle'},
    {key: 'providerMagicLink', labelKey: 'auth.provider.magicLink'},
    {key: 'providerCredentials', labelKey: 'auth.provider.credentials'},
    {key: 'providerGoogle', labelKey: 'auth.provider.google', envKey: 'customerGoogle'},
    {key: 'providerFacebook', labelKey: 'auth.provider.facebook', envKey: 'customerFacebook'},
    {key: 'providerApple', labelKey: 'auth.provider.apple', envKey: 'customerApple'},
];

export const AuthSettings: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new AuthSettingsViewModel());
    useEffect(() => { void vm.refresh(); }, [vm]);

    if (vm.loading) return <Skeleton active/>;

    return (
        <AdminFormModule
            testId="admin-auth-settings"
            title={t('auth.title', {defaultValue: 'Customer login'}) as string}
            error={vm.error}
        >
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 16}}
                message={t('auth.masterToggleHelp', {defaultValue: 'When off, your site behaves like a brochure site with no login surface area. Guest checkout still works.'}) as string}
            />
            <Space direction="vertical" size="middle" style={{width: '100%'}}>
                {FLAG_LABELS.map(({key, labelKey, envKey}) => {
                    const value = vm.flags[key];
                    const envReady = envKey ? Boolean(vm.envReadiness[envKey]) : true;
                    const disabled = vm.busyKey === key || (Boolean(envKey) && !envReady);
                    return (
                        <div key={key} style={{display: 'flex', alignItems: 'center', gap: 12}}>
                            <Switch
                                checked={Boolean(value)}
                                disabled={disabled}
                                onChange={(v) => void vm.toggle(key, v)}
                                data-testid={`admin-auth-toggle-${key}`}
                            />
                            <span style={{flex: 1}}>{t(labelKey, {defaultValue: key}) as string}</span>
                            {envKey ? (
                                envReady
                                    ? <Tag color="success" data-testid={`admin-auth-env-${envKey}-ready`}>{t('auth.env.ready', {defaultValue: 'env: ready'}) as string}</Tag>
                                    : <Tag color="error" data-testid={`admin-auth-env-${envKey}-missing`}>{t('auth.env.missing', {defaultValue: 'env: missing'}) as string}</Tag>
                            ) : null}
                        </div>
                    );
                })}
            </Space>
        </AdminFormModule>
    );
};

export default AuthSettings;
