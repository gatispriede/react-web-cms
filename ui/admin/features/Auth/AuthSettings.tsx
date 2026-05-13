import React, {useEffect} from 'react';
import {Card, Switch, Alert, Skeleton, Tag, Space} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {AuthSettingsViewModel, type AuthFlagKey} from './AuthSettingsViewModel';

/**
 * AuthSettings — admin pane for the auth-split-client-admin master
 * switch + per-provider sub-toggles. VM-backed (no `useState`,
 * mandatory under VM4 policy). Reads via `auth.config.get`,
 * writes via `auth.config.set`. Sonner toasts for save feedback.
 */

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
    if (vm.error) return <Alert type="error" message={vm.error}/>;

    return (
        <Card title={t('auth.title', {defaultValue: 'Customer login'}) as string} data-testid="admin-auth-settings">
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
        </Card>
    );
};

export default AuthSettings;
