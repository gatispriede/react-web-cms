import React, {useEffect} from 'react';
import {Alert, Button, Card, Col, Empty, Radio, Row, Space, Statistic, Table, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import {AnalyticsPanelViewModel, type AnalyticsRange, type CountryRow, type EventRow, type PageRow} from './AnalyticsPanelViewModel';

/**
 * Admin analytics dashboard — `/admin/release/analytics`.
 * Per `docs/features/platform/client-analytics.md` (decision 4 — canned only).
 *
 * Reads `mongo.analyticsSummary(range)`. Renders:
 *   - Range selector (24h / 7d / 30d).
 *   - Top pages table.
 *   - Top events table.
 *   - Refresh + last-loaded stamp.
 *
 * Out of scope (deferred to v2):
 *   - Per-page time series charts.
 *   - Funnel visualisation (funnel data needs Mongo aggregation work).
 *   - Drill-down by user / anonId.
 */

const RANGE_OPTIONS = [
    {value: '24h', label: '24h'},
    {value: '7d', label: '7d'},
    {value: '30d', label: '30d'},
] as const;

const AnalyticsPanel: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new AnalyticsPanelViewModel());

    useEffect(() => { void vm.refresh(); }, [vm, vm.range]);

    const summary = vm.summary;
    const totalPageviews = (summary?.topPages ?? []).reduce((acc, r) => acc + r.count, 0);
    const totalEvents = (summary?.topEvents ?? []).reduce((acc, r) => acc + r.count, 0);

    return (
        <div style={{padding: 16}}>
            <Card
                title={t('Analytics')}
                extra={
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
            >
                <Alert
                    type="info"
                    showIcon
                    style={{marginBottom: 12}}
                    message={t('First-party analytics — no third-party scripts. Anonymous + logged-in interactions, 90-day retention. Honours Sec-GPC / DNT.')}
                />
                {summary?.error ? (
                    <Empty description={summary.error}/>
                ) : !summary ? (
                    <Empty description={t('No data')}/>
                ) : (
                    <>
                        <Row gutter={16} style={{marginBottom: 16}}>
                            <Col span={8}>
                                <Statistic title={t('Pageviews (top 10 paths)')} value={totalPageviews}/>
                            </Col>
                            <Col span={8}>
                                <Statistic title={t('Events (top 10 names)')} value={totalEvents}/>
                            </Col>
                            <Col span={8}>
                                <Statistic title={t('Since')} value={summary.since.split('T')[0]}/>
                            </Col>
                        </Row>
                        <Row gutter={16}>
                            <Col span={12}>
                                <Typography.Title level={5}>{t('Top pages')}</Typography.Title>
                                <Table<PageRow>
                                    rowKey="path"
                                    size="small"
                                    pagination={false}
                                    dataSource={summary.topPages}
                                    columns={[
                                        {title: t('Path'), dataIndex: 'path', key: 'path'},
                                        {title: t('Views'), dataIndex: 'count', key: 'count', width: 80, align: 'right'},
                                    ]}
                                    locale={{emptyText: t('No pageviews')}}
                                />
                            </Col>
                            <Col span={12}>
                                <Typography.Title level={5}>{t('Top events')}</Typography.Title>
                                <Table<EventRow>
                                    rowKey="name"
                                    size="small"
                                    pagination={false}
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
                                    rowKey="country"
                                    size="small"
                                    pagination={false}
                                    dataSource={summary.topCountries ?? []}
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
                        </Row>
                        {vm.loadedAt && (
                            <Typography.Text type="secondary" style={{display: 'block', marginTop: 12, fontSize: 12}}>
                                {t('Loaded at {{time}}', {time: vm.loadedAt.toLocaleTimeString()})}
                            </Typography.Text>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
};

export default AnalyticsPanel;
