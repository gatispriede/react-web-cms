/**
 * Polish bundle (W8g follow-up) — multi-currency admin pane.
 *
 * Owns three SiteFlags fields:
 *  - `enabledCurrencies` — operator-picked subset of `SUPPORTED_CURRENCIES`.
 *    Empty = "all". `<Select mode="multiple">` with predefined options
 *    (per project policy: no free-text where the value space is
 *    enumerable).
 *  - `defaultCurrency` — single picker; constrained to the enabled list
 *    when non-empty.
 *  - `stripeTaxEnabled` — toggle. Inert when `STRIPE_SECRET_KEY` env
 *    var is absent; the status badge surfaces that gating to the
 *    operator so the toggle isn't mysterious when nothing happens.
 *
 * Save uses Sonner `notifyPromise` for the "writing flags → settled"
 * UX, matching the rest of the admin surface. VM-backed
 * (per project policy: no `useState` in admin features).
 */
import React, {useEffect} from 'react';
import {Alert, Badge, Button, Card, Form, Select, Space, Switch, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {SUPPORTED_CURRENCIES} from '@interfaces/IPricing';
import {useViewModel} from '@client/lib/state/observable';
import {CurrencySettingsViewModel} from './CurrencySettingsViewModel';

const {Title, Text} = Typography;

const CurrencySettings: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new CurrencySettingsViewModel(t));
    useEffect(() => { void vm.refresh(); }, [vm]);

    if (vm.loading) return <Card loading data-testid="currency-settings-loading"/>;

    const enabled = vm.flags.enabledCurrencies ?? [];
    const defaultCurrency = vm.flags.defaultCurrency ?? 'EUR';

    const currencyOptions = SUPPORTED_CURRENCIES.map(c => ({value: c, label: c}));
    const defaultOptions = enabled.length > 0
        ? enabled.map(c => ({value: c, label: c}))
        : currencyOptions;

    return (
        <div data-testid="currency-settings-pane" style={{maxWidth: 760}}>
            <Title level={3}>{t('pricing.section.currency', {defaultValue: 'Currencies'})}</Title>
            {vm.err && <Alert type="error" showIcon message={vm.err} style={{marginBottom: 12}}/>}

            <Card style={{marginBottom: 12}}>
                <Form layout="vertical">
                    <Form.Item label={t('pricing.enabledCurrencies', {defaultValue: 'Enabled currencies'})}>
                        <Select
                            data-testid="currency-enabled-select"
                            mode="multiple"
                            value={enabled}
                            onChange={(v) => vm.setEnabledCurrencies(v as string[])}
                            options={currencyOptions}
                            placeholder={t('pricing.enabledHelp', {defaultValue: 'Pick the currencies you accept (empty = all supported)'})}
                        />
                    </Form.Item>
                    <Form.Item label={t('pricing.defaultCurrency', {defaultValue: 'Default currency'})}>
                        <Select
                            data-testid="currency-default-select"
                            value={defaultCurrency}
                            onChange={(v) => vm.setDefaultCurrency(v as string)}
                            options={defaultOptions}
                            style={{width: 200}}
                        />
                    </Form.Item>
                </Form>
            </Card>

            <Card style={{marginBottom: 12}}>
                <Title level={5}>{t('pricing.section.stripe', {defaultValue: 'Stripe Tax'})}</Title>
                <Space direction="vertical" style={{width: '100%'}}>
                    <div>
                        <Text strong style={{marginRight: 8}}>STRIPE_SECRET_KEY:</Text>
                        {vm.stripe.present
                            ? <Badge
                                data-testid="currency-stripe-status-present"
                                status="success"
                                text={t('pricing.stripe.status.present', {mode: vm.stripe.mode ?? 'unknown', defaultValue: 'Configured ({{mode}} mode)'})}
                            />
                            : <Badge
                                data-testid="currency-stripe-status-absent"
                                status="default"
                                text={t('pricing.stripe.status.absent', {defaultValue: 'Not configured'})}
                            />
                        }
                    </div>
                    <div>
                        <Switch
                            data-testid="currency-stripe-toggle"
                            disabled={!vm.stripe.present}
                            checked={Boolean(vm.flags.stripeTaxEnabled)}
                            onChange={(v) => vm.setStripeTaxEnabled(v)}
                        />
                        <Text style={{marginLeft: 8}}>
                            {t('pricing.stripe.enabled', {defaultValue: 'Use Stripe Tax for VAT calculation'})}
                        </Text>
                    </div>
                </Space>
            </Card>

            <Button
                type="primary"
                loading={vm.saving}
                onClick={() => void vm.save()}
                data-testid="currency-save"
            >
                {t('actions.save', {defaultValue: 'Save'})}
            </Button>
        </div>
    );
};

export default CurrencySettings;
