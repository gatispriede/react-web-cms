import React from 'react';
import {Alert, Button, Card, Checkbox, Form, Input, Select, Space, Steps, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {OnboardingViewModel, PASSWORD_MIN_LENGTH} from './OnboardingViewModel';
import {LANGUAGE_PRESETS} from '@admin/features/Languages/languagePresets';

/**
 * Q7 — first-run onboarding wizard. Three steps inside an AntD Steps
 * shell. The VM owns all state; this file is render + delegate.
 */

// Editorial preset names — match what `ThemeService.PRESETS` seeds.
const THEME_PICKS: ReadonlyArray<{key: string; label: string; description: string}> = [
    {key: 'Industrial', label: 'Industrial', description: 'Bold typography, deep neutrals — agency / studio.'},
    {key: 'Studio', label: 'Studio', description: 'Parchment palette, serif display — boutique / portfolio.'},
    {key: 'Paper', label: 'Paper', description: 'Minimal whitespace, hairline rules — editorial / journal.'},
    {key: 'Classic', label: 'Classic', description: 'Familiar AntD blue — safest default.'},
];

export interface OnboardingWizardProps {
    onComplete?: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({onComplete}) => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new OnboardingViewModel(onComplete));

    return (
        <div style={{maxWidth: 720, margin: '48px auto', padding: 24}}>
            <Typography.Title level={2}>{t('Set up your site')}</Typography.Title>
            <Typography.Paragraph type="secondary">
                {t('Three quick steps to get a fresh CMS install ready for content.')}
            </Typography.Paragraph>

            <Steps
                current={vm.step}
                style={{marginBottom: 32}}
                items={[
                    {title: t('Site')},
                    {title: t('Admin account')},
                    {title: t('Theme')},
                ]}
            />

            {vm.error && (
                <Alert type="error" showIcon style={{marginBottom: 16}} message={vm.error}/>
            )}

            {vm.step === 0 && <StepSite vm={vm} t={t}/>}
            {vm.step === 1 && <StepAdmin vm={vm} t={t}/>}
            {vm.step === 2 && <StepTheme vm={vm} t={t}/>}

            <Space style={{marginTop: 24}}>
                {vm.step > 0 && (
                    <Button onClick={() => vm.back()} disabled={vm.submitting}>
                        {t('Back')}
                    </Button>
                )}
                {vm.step < 2 && (
                    <Button
                        type="primary"
                        onClick={() => vm.next()}
                        disabled={!vm.canAdvance()}
                        data-testid="onboarding-next-btn"
                    >
                        {t('Next')}
                    </Button>
                )}
                {vm.step === 2 && (
                    <Button
                        type="primary"
                        onClick={() => void vm.submit()}
                        loading={vm.submitting}
                        disabled={!vm.canAdvance()}
                        data-testid="onboarding-finish-btn"
                    >
                        {t('Finish setup')}
                    </Button>
                )}
            </Space>
        </div>
    );
};

const StepSite: React.FC<{vm: OnboardingViewModel; t: (k: string) => string}> = ({vm, t}) => (
    <Form layout="vertical">
        <Form.Item label={t('Site name')} required>
            <Input
                value={vm.draft.siteName}
                onChange={e => vm.set('siteName', e.target.value)}
                placeholder={t('e.g. Acme Studio')}
                data-testid="onboarding-site-name"
                autoFocus
            />
        </Form.Item>
        <Form.Item label={t('Default language')} required>
            <Select
                value={vm.draft.locale}
                onChange={v => vm.set('locale', v)}
                data-testid="onboarding-locale"
                options={LANGUAGE_PRESETS.map(p => ({
                    value: p.symbol,
                    label: `${p.flag} ${p.label} (${p.symbol})`,
                }))}
                showSearch
                optionFilterProp="label"
            />
        </Form.Item>
    </Form>
);

const StepAdmin: React.FC<{vm: OnboardingViewModel; t: (k: string) => string}> = ({vm, t}) => (
    <Form layout="vertical">
        <Form.Item label={t('Admin email')} required>
            <Input
                value={vm.draft.adminEmail}
                onChange={e => vm.set('adminEmail', e.target.value)}
                type="email"
                autoComplete="username"
                data-testid="onboarding-email"
                autoFocus
            />
        </Form.Item>
        <Form.Item
            label={t('Password')}
            required
            help={t(`At least ${PASSWORD_MIN_LENGTH} characters. Use a passphrase you can remember.`)}
        >
            <Input.Password
                value={vm.draft.adminPassword}
                onChange={e => vm.set('adminPassword', e.target.value)}
                autoComplete="new-password"
                data-testid="onboarding-password"
            />
        </Form.Item>
        <Form.Item label={t('Confirm password')} required>
            <Input.Password
                value={vm.draft.adminPasswordConfirm}
                onChange={e => vm.set('adminPasswordConfirm', e.target.value)}
                autoComplete="new-password"
                data-testid="onboarding-password-confirm"
            />
        </Form.Item>
        <Form.Item>
            <Checkbox
                checked={vm.draft.confirmFirstAdmin}
                onChange={e => vm.set('confirmFirstAdmin', e.target.checked)}
                data-testid="onboarding-confirm"
            >
                {t('I understand this is the first admin and cannot be undone from the wizard.')}
            </Checkbox>
        </Form.Item>
    </Form>
);

const StepTheme: React.FC<{vm: OnboardingViewModel; t: (k: string) => string}> = ({vm, t}) => (
    <div>
        <Typography.Paragraph type="secondary">
            {t('Pick a starting theme. You can change it later under Themes.')}
        </Typography.Paragraph>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16}}>
            {THEME_PICKS.map(pick => {
                const selected = vm.draft.themeKey === pick.key;
                return (
                    <Card
                        key={pick.key}
                        hoverable
                        onClick={() => vm.set('themeKey', pick.key)}
                        data-testid={`onboarding-theme-${pick.key.toLowerCase()}`}
                        style={{
                            borderColor: selected ? '#1677ff' : undefined,
                            borderWidth: selected ? 2 : 1,
                            outline: selected ? '2px solid rgba(22,119,255,0.15)' : 'none',
                        }}
                    >
                        <Typography.Title level={4} style={{marginTop: 0}}>
                            {pick.label} {selected && <span aria-label="selected">✓</span>}
                        </Typography.Title>
                        <Typography.Paragraph type="secondary" style={{marginBottom: 0}}>
                            {pick.description}
                        </Typography.Paragraph>
                    </Card>
                );
            })}
        </div>
    </div>
);

export default OnboardingWizard;
