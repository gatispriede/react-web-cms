/**
 * admin-module-composed — Analytics dashboard bridge.
 *
 * The `AdminLoader` bridge for `seo/analytics`. `AnalyticsPanelViewModel`
 * is unchanged ("admin stays mostly same"); the hand-coded card chrome
 * is replaced by a single `AdminInfo` surface. The dense dashboard body
 * (range/audience selectors, KPI tiles, the recharts time-series, and
 * the breakdown tables) doesn't reduce to generic key/value rows, so it
 * stays bespoke inside `node` blocks the bridge feeds the module.
 *
 * Layout (top → bottom):
 *   - Range selector (24h / 7d / 30d) + audience filter chips.
 *   - KPI tiles: pageviews, unique visitors, sessions, events.
 *   - Daily time-series line chart (pageviews + unique visitors).
 *   - Audience-mix tags (always over the un-filtered range).
 *   - Top pages / events tables.
 *   - Top countries / referrers tables.
 *   - Device / browser / OS breakdown tables.
 *
 * The dashboard's default audience is `public` — admin/internal/bot
 * traffic is filtered out so the customer numbers stay clean. The chips
 * surface the share % so it's obvious when the noise is large.
 */
import React, {useEffect, useMemo} from 'react';
import {Alert, Button, Card, Col, Empty, Radio, Row, Segmented, Space, Statistic, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid} from 'recharts';
import {useViewModel} from '@client/lib/state/observable';
import AdminInfoModule from '@admin/modules/shapes/AdminInfoModule';
import type {AdminInfoBlock} from '@admin/modules/shapes/AdminInfoModule.types';
import PaneHeader from '@admin/shell/PaneHeader';
import {
    AnalyticsPanelViewModel,
    type AnalyticsRange,
    type AudienceFilter,
    type DailyRow,
    type PageRow,
    type EventRow,
    type CountryRow,
    type ReferrerRow,
    type DeviceRow,
    type BrowserRow,
    type OsRow,
} from './AnalyticsPanelViewModel';
import type {AnalyticsAudience} from '@interfaces/IAnalytics';

const RANGE_OPTIONS = [
    {value: '24h', label: '24h'},
    {value: '7d', label: '7d'},
    {value: '30d', label: '30d'},
] as const;

const AUDIENCE_ORDER: readonly AudienceFilter[] = ['public', 'admin', 'internal', 'bot', 'all'];

function formatPercent(part: number, total: number): string {
    if (total <= 0) return '0%';
    return `${Math.round((part / total) * 100)}%`;
}

const AnalyticsPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new AnalyticsPanelViewModel());

    useEffect(() => { void vm.refresh(); }, [vm, vm.range, vm.audience]);

    const summary = vm.summary;
    const totalAudience = useMemo(
        () => (summary?.audienceMix ?? []).reduce((acc, r) => acc + r.count, 0),
        [summary?.audienceMix],
    );
    const audienceCounts = useMemo(() => {
        const out: Record<AnalyticsAudience, number> = {public: 0, admin: 0, internal: 0, bot: 0};
        for (const row of summary?.audienceMix ?? []) out[row.audience] = row.count;
        return out;
    }, [summary?.audienceMix]);

    const audienceOptions = AUDIENCE_ORDER.map(a => {
        if (a === 'all') return {value: a, label: t('All')};
        const aud = a as AnalyticsAudience;
        return {
            value: a,
            label: (
                <Space size={4}>
                    <span style={{textTransform: 'capitalize'}}>{aud}</span>
                    {totalAudience > 0 && (
                        <Tag style={{marginInlineEnd: 0}}>
                            {formatPercent(audienceCounts[aud] ?? 0, totalAudience)}
                        </Tag>
                    )}
                </Space>
            ),
        };
    });

    const toolbar = (
        <>
            <Alert
                type="info"
                showIcon
                style={{marginBottom: 12}}
                message={t('First-party analytics — no third-party scripts. 90-day retention. Honours Sec-GPC / DNT. Audience filter excludes admin / internal / bot traffic by default.')}
            />
            <Segmented
                value={vm.audience}
                onChange={(v) => vm.setAudience(v as AudienceFilter)}
                options={audienceOptions as any}
                size="middle"
            />
        </>
    );

    const blocks: AdminInfoBlock[] = summary?.error ? [
        {kind: 'node', testId: 'analytics-error', node: <Empty description={summary.error}/>},
    ] : !summary ? [
        {kind: 'node', testId: 'analytics-no-data', node: <Empty description={t('No data')}/>},
    ] : [
        {
            kind: 'node',
            testId: 'analytics-kpis',
            node: (
                <Row gutter={16}>
                    <Col span={6}>
                        <Statistic title={t('Pageviews')} value={summary.totals.pageviews}/>
                    </Col>
                    <Col span={6}>
                        <Statistic title={t('Unique visitors')} value={summary.totals.uniqueAnon}/>
                        <Typography.Text type="secondary" style={{fontSize: 11}}>
                            {t('logged-in: {{n}}', {n: summary.totals.uniqueUsers})}
                        </Typography.Text>
                    </Col>
                    <Col span={6}>
                        <Statistic title={t('Sessions')} value={summary.totals.sessions}/>
                    </Col>
                    <Col span={6}>
                        <Statistic title={t('Events')} value={summary.totals.events}/>
                    </Col>
                </Row>
            ),
        },
        {
            kind: 'node',
            heading: t('Daily traffic'),
            testId: 'analytics-daily',
            node: summary.daily.length === 0 ? (
                <Empty description={t('No data in range')} style={{padding: 24}}/>
            ) : (
                <div style={{height: 240}}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={summary.daily} margin={{top: 16, right: 16, left: 0, bottom: 0}}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)"/>
                            <XAxis dataKey="day" tick={{fontSize: 11}}/>
                            <YAxis allowDecimals={false} tick={{fontSize: 11}} width={40}/>
                            <Tooltip/>
                            <Line type="monotone" dataKey="pageviews" name={t('Pageviews')} stroke="#1677ff" strokeWidth={2} dot={false}/>
                            <Line type="monotone" dataKey="uniqueAnon" name={t('Unique')} stroke="#13c2c2" strokeWidth={2} dot={false}/>
                            <Line type="monotone" dataKey="events" name={t('Events')} stroke="#faad14" strokeWidth={2} dot={false}/>
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ),
        },
        {
            kind: 'node',
            testId: 'analytics-tables',
            node: (
                <>
                    <Row gutter={16}>
                        <Col span={12}>
                            <Typography.Title level={5}>{t('Top pages')}</Typography.Title>
                            <Table<PageRow>
                                rowKey="path" size="small" pagination={false}
                                dataSource={summary.topPages}
                                columns={[
                                    {title: t('Path'), dataIndex: 'path', key: 'path', ellipsis: true},
                                    {title: t('Views'), dataIndex: 'count', key: 'count', width: 80, align: 'right'},
                                ]}
                                locale={{emptyText: t('No pageviews')}}
                            />
                        </Col>
                        <Col span={12}>
                            <Typography.Title level={5}>{t('Top events')}</Typography.Title>
                            <Table<EventRow>
                                rowKey="name" size="small" pagination={false}
                                dataSource={summary.topEvents}
                                columns={[
                                    {title: t('Name'), dataIndex: 'name', key: 'name'},
                                    {title: t('Count'), dataIndex: 'count', key: 'count', width: 80, align: 'right'},
                                ]}
                                locale={{emptyText: t('No events')}}
                            />
                        </Col>
                    </Row>

                    <Row gutter={16} style={{marginTop: 16}}>
                        <Col span={12}>
                            <Typography.Title level={5}>{t('Top countries')}</Typography.Title>
                            <Table<CountryRow>
                                rowKey="country" size="small" pagination={false}
                                dataSource={summary.topCountries}
                                columns={[
                                    {title: t('Country'), dataIndex: 'country', key: 'country'},
                                    {title: t('Hits'), dataIndex: 'count', key: 'count', width: 80, align: 'right'},
                                ]}
                                locale={{emptyText: t('No country data')}}
                            />
                            <Typography.Text type="secondary" style={{display: 'block', marginTop: 4, fontSize: 11}}>
                                {t('Derived from request IP at ingest; the IP itself is never stored.')}
                            </Typography.Text>
                        </Col>
                        <Col span={12}>
                            <Typography.Title level={5}>{t('Top referrers')}</Typography.Title>
                            <Table<ReferrerRow>
                                rowKey="referrer" size="small" pagination={false}
                                dataSource={summary.topReferrers}
                                columns={[
                                    {title: t('Referrer'), dataIndex: 'referrer', key: 'referrer', ellipsis: true},
                                    {title: t('Hits'), dataIndex: 'count', key: 'count', width: 80, align: 'right'},
                                ]}
                                locale={{emptyText: t('No referrer data')}}
                            />
                        </Col>
                    </Row>

                    <Row gutter={16} style={{marginTop: 16}}>
                        <Col span={8}>
                            <Typography.Title level={5}>{t('Devices')}</Typography.Title>
                            <Table<DeviceRow>
                                rowKey="device" size="small" pagination={false}
                                dataSource={summary.devices}
                                columns={[
                                    {title: t('Device'), dataIndex: 'device', key: 'device'},
                                    {title: t('Hits'), dataIndex: 'count', key: 'count', width: 80, align: 'right'},
                                ]}
                                locale={{emptyText: t('No device data')}}
                            />
                        </Col>
                        <Col span={8}>
                            <Typography.Title level={5}>{t('Browsers')}</Typography.Title>
                            <Table<BrowserRow>
                                rowKey="browser" size="small" pagination={false}
                                dataSource={summary.browsers}
                                columns={[
                                    {title: t('Browser'), dataIndex: 'browser', key: 'browser'},
                                    {title: t('Hits'), dataIndex: 'count', key: 'count', width: 80, align: 'right'},
                                ]}
                                locale={{emptyText: t('No browser data')}}
                            />
                        </Col>
                        <Col span={8}>
                            <Typography.Title level={5}>{t('Operating systems')}</Typography.Title>
                            <Table<OsRow>
                                rowKey="os" size="small" pagination={false}
                                dataSource={summary.osFamilies}
                                columns={[
                                    {title: t('OS'), dataIndex: 'os', key: 'os'},
                                    {title: t('Hits'), dataIndex: 'count', key: 'count', width: 80, align: 'right'},
                                ]}
                                locale={{emptyText: t('No OS data')}}
                            />
                        </Col>
                    </Row>

                    {vm.loadedAt && (
                        <Typography.Text type="secondary" style={{display: 'block', marginTop: 12, fontSize: 12}}>
                            {t('Loaded at {{time}}', {time: vm.loadedAt.toLocaleTimeString()})}
                        </Typography.Text>
                    )}
                </>
            ),
        },
    ];

    return (
        <div style={{padding: 'var(--admin-rhythm-md, 16px)'}}>
            <PaneHeader
                testId="admin-analytics-header"
                eyebrow={t('Analytics')}
                title={t('Analytics')}
                description={t('Public-audience pageviews, sessions, and top pages. Switch the audience chips to inspect admin / bot traffic separately.')}
                actions={
                    <Space>
                        <Radio.Group
                            value={vm.range}
                            onChange={(e) => vm.setRange(e.target.value as AnalyticsRange)}
                            options={RANGE_OPTIONS as unknown as {value: string; label: string}[]}
                            optionType="button"
                            buttonStyle="solid"
                            size="small"
                        />
                        <Button onClick={() => void vm.refresh()} loading={vm.loading}>{t('Refresh')}</Button>
                    </Space>
                }
            />
            <AdminInfoModule
                testId="admin-analytics"
                title=""
                toolbar={toolbar}
                blocks={blocks}
            />
        </div>
    );
};

// Suppress TS6133 (unused type imports kept for future drill-downs).
export type _Unused = DailyRow;

export default AnalyticsPanel;
