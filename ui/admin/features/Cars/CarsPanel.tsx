/**
 * Cars admin pane — Wave 7b. Lists imported car listings + the
 * reservation queue. Admin actions:
 *  - Import from fixture (always available)
 *  - Import from live (env-gated; will no-op unless operator enabled
 *    SSCOM_FETCH_ENABLED + SSCOM_FETCH_URL)
 *  - Confirm deposit on a pending reservation
 *  - Cancel a reservation
 */
import React, {useEffect, useMemo} from 'react';
import {Badge, Button, Card, Popconfirm, Select, Space, Table, Tabs, Tag, Typography} from 'antd';
import {DownloadOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined} from '@client/lib/icons';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {useRefreshView} from '@client/lib/useRefreshView';
import {CarsViewModel, type CarRow, type ReservationRow} from './CarsViewModel';

const formatPrice = (cents: number | null | undefined, currency: string | null | undefined) => {
    if (cents == null) return '—';
    try {
        return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'EUR', maximumFractionDigits: 0}).format(cents / 100);
    } catch {
        return `${Math.round(cents / 100)} ${currency ?? ''}`;
    }
};

const formatDate = (iso: string | undefined) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

const CarsPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new CarsViewModel(t));
    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    const listingColumns = useMemo(() => [
        {title: t('Title'), dataIndex: 'title', key: 'title', render: (v: string, r: CarRow) => (
            <Space orientation="vertical" size={0}>
                <Typography.Text strong>{v}</Typography.Text>
                <Typography.Text type="secondary" style={{fontSize: 12}}>{r.slug}</Typography.Text>
            </Space>
        )},
        {title: t('External ID'), dataIndex: 'externalId', key: 'externalId', width: 180,
            render: (v: string) => <Typography.Text code style={{fontSize: 12}}>{v ?? '—'}</Typography.Text>},
        {title: t('Price'), dataIndex: 'price', key: 'price', width: 110,
            render: (_: unknown, r: CarRow) => formatPrice(r.price, r.currency)},
        {title: t('VAT'), key: 'vat', width: 120,
            render: (_: unknown, r: CarRow) => {
                const v = r.attributes?.vat_regime;
                if (!v) return <Tag>{t('cars.vat.unknown', {defaultValue: 'Unknown'}) as string}</Tag>;
                return <Tag>{v}</Tag>;
            }},
        {title: t('Updated'), dataIndex: 'updatedAt', key: 'updatedAt', width: 170,
            render: (v: string) => <Typography.Text style={{fontSize: 12}}>{formatDate(v)}</Typography.Text>},
    ], [t]);

    const reservationColumns = useMemo(() => [
        {title: t('Received'), dataIndex: 'createdAt', key: 'createdAt', width: 170,
            render: (v: string) => <Typography.Text style={{fontSize: 12}}>{formatDate(v)}</Typography.Text>},
        {title: t('Car'), key: 'car',
            render: (_: unknown, r: ReservationRow) => (
                <Space orientation="vertical" size={0}>
                    <Typography.Text strong>{r.car?.title ?? r.car?.externalId ?? '—'}</Typography.Text>
                    <Typography.Text type="secondary" style={{fontSize: 12}}>
                        {formatPrice(r.car?.priceCents, r.car?.currency)} {r.car?.vatRegime ? `· ${r.car.vatRegime}` : ''}
                    </Typography.Text>
                </Space>
            )},
        {title: t('Buyer'), key: 'buyer',
            render: (_: unknown, r: ReservationRow) => (
                <Space orientation="vertical" size={0}>
                    <Typography.Text>{r.name}</Typography.Text>
                    <Typography.Text type="secondary" style={{fontSize: 12}}>{r.email}</Typography.Text>
                    {r.phone ? <Typography.Text type="secondary" style={{fontSize: 12}}>{r.phone}</Typography.Text> : null}
                </Space>
            )},
        {title: t('Status'), key: 'status', width: 140,
            render: (_: unknown, r: ReservationRow) => {
                const s = r.reservationStatus ?? 'pending';
                if (s === 'deposit-confirmed') return <Tag color="green">{t('cars.res.confirmed', {defaultValue: 'Deposit confirmed'}) as string}</Tag>;
                if (s === 'cancelled') return <Tag>{t('cars.res.cancelled', {defaultValue: 'Cancelled'}) as string}</Tag>;
                return <Tag color="gold">{t('cars.res.pending', {defaultValue: 'Pending'}) as string}</Tag>;
            }},
        {title: t('Actions'), key: 'actions', width: 220,
            render: (_: unknown, r: ReservationRow) => {
                const s = r.reservationStatus ?? 'pending';
                if (s !== 'pending') return null;
                return (
                    <Space size={4}>
                        <Popconfirm
                            title={t('cars.res.confirm.title', {defaultValue: 'Confirm deposit?'}) as string}
                            description={t('cars.res.confirm.body', {defaultValue: 'Marks this reservation as deposit-confirmed.'}) as string}
                            okText={t('Confirm', {defaultValue: 'Confirm'}) as string}
                            onConfirm={() => vm.confirmDeposit(r.id)}
                        >
                            <Button data-testid={`cars-res-${r.id}-confirm-button`} size="small" type="primary" icon={<CheckCircleOutlined/>}>
                                {t('cars.res.confirm.cta', {defaultValue: 'Confirm deposit'}) as string}
                            </Button>
                        </Popconfirm>
                        <Popconfirm
                            title={t('cars.res.cancel.title', {defaultValue: 'Cancel reservation?'}) as string}
                            okText={t('Cancel reservation', {defaultValue: 'Cancel'}) as string}
                            okButtonProps={{danger: true}}
                            onConfirm={() => vm.cancelReservation(r.id)}
                        >
                            <Button data-testid={`cars-res-${r.id}-cancel-button`} size="small" danger icon={<CloseCircleOutlined/>}>
                                {t('Cancel', {defaultValue: 'Cancel'}) as string}
                            </Button>
                        </Popconfirm>
                    </Space>
                );
            }},
    ], [t, vm]);

    return (
        <div data-testid="cars-admin-panel" style={{padding: 16, overflowY: 'auto'}}>
            <Space style={{marginBottom: 12, width: '100%', justifyContent: 'space-between'}}>
                <Space>
                    <Typography.Title level={4} style={{margin: 0}}>{t('Cars', {defaultValue: 'Cars'}) as string}</Typography.Title>
                    <Badge count={vm.pendingReservations} color="#5e554b"/>
                </Space>
                <Space>
                    <Select
                        data-testid="cars-import-source-select"
                        defaultValue="fixture"
                        style={{minWidth: 140}}
                        options={[
                            {value: 'fixture', label: t('cars.import.fixture', {defaultValue: 'Fixture'}) as string},
                            {value: 'live', label: t('cars.import.live', {defaultValue: 'Live (env-gated)'}) as string},
                        ]}
                        onChange={(v: string) => { (vm as unknown as {_pendingSource?: string})._pendingSource = v; }}
                    />
                    <Button
                        data-testid="cars-import-button"
                        type="primary"
                        icon={<DownloadOutlined/>}
                        loading={vm.busy}
                        onClick={() => {
                            const src = ((vm as unknown as {_pendingSource?: string})._pendingSource ?? 'fixture') as 'fixture' | 'live';
                            void vm.importFrom(src);
                        }}
                    >
                        {t('cars.import.cta', {defaultValue: 'Import now'}) as string}
                    </Button>
                    <Button data-testid="cars-refresh-button" icon={<ReloadOutlined/>} loading={vm.loading} onClick={vm.refresh}>
                        {t('Refresh', {defaultValue: 'Refresh'}) as string}
                    </Button>
                </Space>
            </Space>

            <Tabs
                activeKey={vm.activeTab}
                onChange={(k) => vm.setTab(k as 'listings' | 'reservations')}
                items={[
                    {
                        key: 'listings',
                        label: <span data-testid="cars-tab-listings">{t('Listings', {defaultValue: 'Listings'}) as string} ({vm.listings.length})</span>,
                        children: (
                            <Card>
                                <Table
                                    data-testid="cars-listings-table"
                                    rowKey={(r: CarRow) => r.id}
                                    loading={vm.loading}
                                    dataSource={vm.listings}
                                    columns={listingColumns}
                                    pagination={{pageSize: 25}}
                                    size="middle"
                                    onRow={(r: CarRow) => ({'data-testid': `cars-listing-row-${r.id}`} as any)}
                                />
                            </Card>
                        ),
                    },
                    {
                        key: 'reservations',
                        label: <span data-testid="cars-tab-reservations">{t('Reservations', {defaultValue: 'Reservations'}) as string} ({vm.reservations.length})</span>,
                        children: (
                            <Card>
                                <Table
                                    data-testid="cars-reservations-table"
                                    rowKey={(r: ReservationRow) => r.id}
                                    loading={vm.loading}
                                    dataSource={vm.reservations}
                                    columns={reservationColumns}
                                    pagination={{pageSize: 25}}
                                    size="middle"
                                    onRow={(r: ReservationRow) => ({'data-testid': `cars-reservation-row-${r.id}`} as any)}
                                />
                            </Card>
                        ),
                    },
                ]}
            />
        </div>
    );
};

export default CarsPanel;
