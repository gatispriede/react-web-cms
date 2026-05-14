import React from 'react';
import {Alert, Button, Card, Checkbox, Form, Input, Select, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import AdminWizardModule from '@admin/modules/shapes/AdminWizardModule';
import {OnboardingViewModel, PASSWORD_MIN_LENGTH} from './OnboardingViewModel';
import {LANGUAGE_PRESETS} from '@admin/features/Languages/languagePresets';

/**
 * Q7 — first-run onboarding wizard.
 *
 * admin-module-composed — the bespoke `Steps` + Back/Next footer chrome
 * moves into the generic `AdminWizard` shape; `OnboardingViewModel` is
 * unchanged and still owns the 3-step state machine. This file maps the
 * VM's `step` / `next` / `back` / `submit` onto the module's props and
 * renders the active step's bespoke form in `children`.
 *
 * Registered with the `AdminPageRegistry` by `OnboardingAdminLoader`;
 * the shell reaches it via `AdminPageDispatch` (see
 * `OnboardingAdminUILoader`).
 */

// First-class theme picks — match what `ThemeService.PRESETS` seeds.
// Each preset is differentiated on palette + typography + motion + header
// behaviour + radii, not just colour. Legacy colour-only presets removed
// 2026-05-13 (Industrial / Studio / Paper / High contrast + the inline
// Classic / Ocean / Brandappart / Forest / Midnight blocks) — see the
// cleanup commit. A theme that doesn't differentiate the page isn't a
// theme worth picking.
const THEME_PICKS: ReadonlyArray<{key: string; label: string; description: string}> = [
    {key: 'Editorial', label: 'Editorial', description: 'Warm cream paper, Source Serif Pro, slow + deliberate motion — writers, photographers, considered portfolios.'},
    {key: 'Commerce', label: 'Commerce', description: 'Pure white + emerald, Space Grotesk, snappy retail motion — DTC product shops, makers, the cars vertical.'},
    {key: 'SaaS Landing', label: 'SaaS Landing', description: 'Dark-default + violet gradient, Mona Sans + JetBrains Mono, sticky-blur header — B2B SaaS, developer tools, infra.'},
    {key: 'Agency', label: 'Agency', description: 'Stark white + true black + coral, Geist, expressive-bold spring motion, hide-on-down nav — design studios, case-study portfolios.'},
    {key: 'Restaurant', label: 'Restaurant', description: 'Warm khaki paper + burgundy, Fraunces + Manrope, considered motion — restaurants, cafes, neighbourhood hospitality.'},
];

export interface OnboardingWizardProps {
    onComplete?: () => void;
}

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({onComplete}) => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new OnboardingViewModel(onComplete));

    const steps = [
        {key: 'site', title: t('Site')},
        {key: 'admin', title: t('Admin account')},
        {key: 'theme', title: t('Theme')},
    ];

    return (
        <div style={{maxWidth: 720, margin: '48px auto'}}>
            <Typography.Title level={2}>{t('Set up your site')}</Typography.Title>
            <Typography.Paragraph type="secondary">
                {t('Three quick steps to get a fresh CMS install ready for content.')}
            </Typography.Paragraph>

            {vm.error && (
                <Alert type="error" showIcon style={{marginBottom: 16}} message={vm.error}/>
            )}

            <AdminWizardModule
                testId="admin-onboarding"
                steps={steps}
                currentStep={vm.step}
                onBack={() => vm.back()}
                onNext={() => vm.next()}
                nextLabel={t('Next')}
                backLabel={t('Back')}
                nextDisabled={!vm.canAdvance() || vm.submitting}
                nextTestId="onboarding-next-btn"
                finishSlot={
                    <Button
                        type="primary"
                        onClick={() => void vm.submit()}
                        loading={vm.submitting}
                        disabled={!vm.canAdvance()}
                        data-testid="onboarding-finish-btn"
                    >
                        {t('Finish setup')}
                    </Button>
                }
            >
                {vm.step === 0 && <StepSite vm={vm} t={t}/>}
                {vm.step === 1 && <StepAdmin vm={vm} t={t}/>}
                {vm.step === 2 && <StepTheme vm={vm} t={t}/>}
            </AdminWizardModule>
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
        <div style={{marginBottom: 20, padding: 12, border: '1px dashed var(--ant-color-border, #d9d9d9)', borderRadius: 8}}>
            <Checkbox
                checked={vm.seedSample}
                onChange={(e) => vm.setSeedSample(e.target.checked)}
                data-testid="onboarding-seed-sample-checkbox"
            >
                <strong>{t('empty.onboarding.seedTitle')}</strong>
            </Checkbox>
            <Typography.Paragraph type="secondary" style={{marginBottom: 0, marginTop: 4, marginLeft: 24, fontSize: 12}}>
                {t('empty.onboarding.seedDescription')}
            </Typography.Paragraph>
        </div>
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
