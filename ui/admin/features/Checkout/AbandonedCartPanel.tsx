/**
 * Phase 1.B-d — abandoned-cart recovery admin pane.
 *
 * Sections:
 *   1. Master switch — `commerce.abandonedCartEnabled`
 *   2. Delay-minutes Select (predefined: 30 / 60 / 120 / 240 / 1440)
 *   3. Discount-code input — operator-supplied promo
 *   4. Recovery-rate stats card
 *   5. Recent abandonments table (read-only)
 *
 * VM4 — no `useState`. Sonner notifyPromise via the VM. testids on every
 * interactive so e2e specs can drive the surface.
 */
import React, {useEffect} from 'react';
import {Alert, Card, Input, Select, Skeleton, Space, Statistic, Switch, Table, Tag, Typography} from 'antd';
import {ReloadOutlined} from '@client/lib/icons';
import {Button} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {AbandonedCartViewModel, type AbandonedCartRow} from './AbandonedCartViewModel';

const DELAY_OPTIONS: Array<{value: number; label: string}> = [
    {value: 30, label: '30 minutes'},
    {value: 60, label: '60 minutes (default)'},
    {value: 120, label: '2 hours'},
    {value: 240, label: '4 hours'},
    {value: 1440, label: '24 hours'},
];

function formatDate(iso: string | undefined | null): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function formatMoney(minor: number, currency: string): string {
    const amount = Number.isFinite(minor) ? minor / 100 : 0;
    try { return new Intl.NumberFormat(undefined, {style: 'currency', currency}).format(amount); }
    catch { return `${amount.toFixed(2)} ${currency}`; }
}

const STATUS_COLOR: Record<AbandonedCartRow['status'], string> = {
    active: 'blue',
    recovered: 'green',
    converted: 'green',
    abandoned: 'red',
};

const AbandonedCartPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new AbandonedCartViewModel());
    useEffect(() => { void vm.refresh(); }, [vm]);

    if (vm.loading && vm.rows.length === 0 && !vm.state.enabled) {
        return <Skeleton active style={{padding: 16}}/>;
    }

    return (
        <div data-testid="abandoned-cart-admin-panel" style={{padding: 16, overflowY: 'auto'}}>
            <Space style={{marginBottom: 12, width: '100%', justifyContent: 'space-between'}}>
                <Typography.Title level={4} style={{margin: 0}}>
                    {t('abandonedCart.title', {defaultValue: 'Abandoned cart recovery'}) as string}
                </Typography.Title>
                <Button
                    data-testid="abandoned-cart-refresh-button"
                    icon={<ReloadOutlined/>}
                    loading={vm.loading}
                    onClick={() => void vm.refresh()}
                >
                    {t('Refresh', {defaultValue: 'Refresh'}) as string}
                </Button>
            </Space>

            {vm.error ? <Alert type="warning" message={vm.error} style={{marginBottom: 12}}/> : null}

            <Space direction="vertical" size={16} style={{width: '100%'}}>

                <Card
                    title={t('abandonedCart.settings.title', {defaultValue: 'Settings'}) as string}
                    data-testid="abandoned-cart-section-settings"
                >
                    <Space direction="vertical" size={16} style={{width: '100%'}}>
                        <label style={{display: 'flex', alignItems: 'center', gap: 12}}>
                            <Switch
                                data-testid="abandoned-cart-enabled-switch"
                                checked={vm.state.enabled}
                                onChange={(v) => void vm.setEnabled(v)}
                            />
                            <span>
                                <strong>{t('abandonedCart.enabled.label', {defaultValue: 'Send recovery emails'}) as string}</strong>
                                <Typography.Text type="secondary" style={{display: 'block', fontSize: 12}}>
                                    {t('abandonedCart.enabled.help', {defaultValue: 'When on, customers with carts left idle past the delay receive a one-shot recovery email.'}) as string}
                                </Typography.Text>
                            </span>
                        </label>

                        <div>
                            <strong>{t('abandonedCart.delay.label', {defaultValue: 'Delay before sending'}) as string}</strong>
                            <div style={{marginTop: 8}}>
                                <Select
                                    data-testid="abandoned-cart-delay-select"
                                    style={{minWidth: 220}}
                                    value={vm.state.delayMinutes}
                                    options={DELAY_OPTIONS}
                                    onChange={(v: number) => void vm.setDelayMinutes(v)}
                                />
                            </div>
                        </div>

                        <div>
                            <strong>{t('abandonedCart.discount.label', {defaultValue: 'Discount code (optional)'}) as string}</strong>
                            <Typography.Paragraph type="secondary" style={{fontSize: 12, marginBottom: 6}}>
                                {t('abandonedCart.discount.help', {defaultValue: 'Operator-supplied promo code embedded in the recovery email. Leave empty to omit the discount block — the platform never generates codes.'}) as string}
                            </Typography.Paragraph>
                            <Input
                                data-testid="abandoned-cart-discount-input"
                                placeholder="WELCOME10"
                                value={vm.state.discountCode}
                                onChange={(e) => vm.setDiscountCodeLocal(e.target.value)}
                                onBlur={(e) => void vm.setDiscountCode(e.target.value.trim())}
                                style={{maxWidth: 320}}
                                allowClear
                            />
                        </div>
                    </Space>
                </Card>

                <Card
                    title={t('abandonedCart.stats.title', {defaultValue: 'Recovery (last 7 days)'}) as string}
                    data-testid="abandoned-cart-section-stats"
                >
                    <Space size="large" wrap>
                        <Statistic
                            data-testid="abandoned-cart-stat-recovery-rate"
                            title={t('abandonedCart.stats.recoveryRate', {defaultValue: 'Recovery rate'}) as string}
                            value={(vm.stats.recoveryRate * 100).toFixed(1)}
                            suffix="%"
                        />
                        <Statistic
                            title={t('abandonedCart.stats.emailsSent', {defaultValue: 'Emails sent'}) as string}
                            value={vm.stats.recoveryEmailsSent}
                        />
                        <Statistic
                            title={t('abandonedCart.stats.recovered', {defaultValue: 'Recovered'}) as string}
                            value={vm.stats.recovered}
                        />
                        <Statistic
                            title={t('abandonedCart.stats.openLoop', {defaultValue: 'Sent — not recovered'}) as string}
                            value={vm.stats.sentButNotRecovered}
                        />
                    </Space>
                </Card>

                <Card
                    title={t('abandonedCart.recent.title', {defaultValue: 'Recent abandonments'}) as string}
                    data-testid="abandoned-cart-section-recent"
                >
                    <Table<AbandonedCartRow>
                        data-testid="abandoned-cart-recent-table"
                        rowKey="cartId"
                        loading={vm.loading}
                        dataSource={vm.rows}
                        pagination={{pageSize: 25}}
                        size="middle"
                        columns={[
                            {
                                title: t('Customer', {defaultValue: 'Customer'}) as string,
                                dataIndex: 'customerId',
                                render: (v: string) => (
                                    <Typography.Text code style={{fontSize: 12}}>{v}</Typography.Text>
                                ),
                            },
                            {
                                title: t('Updated', {defaultValue: 'Updated'}) as string,
                                dataIndex: 'updatedAt',
                                width: 180,
                                render: (v: string) => <Typography.Text style={{fontSize: 12}}>{formatDate(v)}</Typography.Text>,
                            },
                            {
                                title: t('Email sent', {defaultValue: 'Email sent'}) as string,
                                dataIndex: 'recoveryEmailSentAt',
                                width: 180,
                                render: (v: string | undefined | null) => <Typography.Text style={{fontSize: 12}}>{formatDate(v)}</Typography.Text>,
                            },
                            {
                                title: t('Subtotal', {defaultValue: 'Subtotal'}) as string,
                                width: 120,
                                render: (_: unknown, r: AbandonedCartRow) => (
                                    <Typography.Text style={{fontSize: 12}}>{formatMoney(r.subtotal, r.currency)}</Typography.Text>
                                ),
                            },
                            {
                                title: t('Status', {defaultValue: 'Status'}) as string,
                                dataIndex: 'status',
                                width: 120,
                                render: (s: AbandonedCartRow['status']) => (
                                    <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag>
                                ),
                            },
                        ]}
                    />
                </Card>
            </Space>
        </div>
    );
};

export default AbandonedCartPanel;
