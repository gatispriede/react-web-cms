import React, {useEffect} from 'react';
import {Button, Card, Col, Row, Space, Statistic, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import {useViewModel} from '@client/lib/state/observable';
import EmptyState from '@admin/lib/EmptyState';
import {SeoOverviewViewModel} from './SeoOverviewViewModel';
import type {SeoPreflightWarning} from './SeoOverviewApi';

/**
 * Admin SEO overview pane — W8h SEO polish.
 *
 * Aggregated read-only dashboard: sitemap counts, redirect-row count,
 * OG-coverage stat, and a table of recent pre-flight warnings. The data
 * comes from `/api/admin/seo-overview` (one round-trip) and renders
 * into Ant Statistics + a Table. Pure compose — no new data sources.
 */
const SeoOverviewPane: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new SeoOverviewViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);

    const summary = vm.summary;
    const warnings = summary?.preflight.warnings ?? [];

    const columns = [
        {title: t('Page'), dataIndex: 'page', key: 'page', width: 200},
        {
            title: t('Field'),
            dataIndex: 'field',
            key: 'field',
            width: 120,
            render: (v: string) => <Tag>{v}</Tag>,
        },
        {
            title: t('Severity'),
            dataIndex: 'severity',
            key: 'severity',
            width: 100,
            render: (v: 'warn' | 'error') => (
                <Tag color={v === 'error' ? 'red' : 'orange'} data-testid={`seo-overview-warning-severity-${v}`}>
                    {v}
                </Tag>
            ),
        },
        {title: t('Message'), dataIndex: 'message', key: 'message'},
    ];

    return (
        <Card
            data-testid="seo-overview-pane"
            title={t('seoOverview.title')}
            extra={
                <Button
                    data-testid="seo-overview-refresh-button"
                    onClick={() => void vm.refresh()}
                    loading={vm.loading}
                >
                    {t('seoOverview.refresh')}
                </Button>
            }
        >
            <Typography.Paragraph type="secondary">
                {t('seoOverview.description')}
            </Typography.Paragraph>

            {!summary && !vm.loading ? (
                <EmptyState
                    testId="seo-overview-empty-state"
                    title={t('seoOverview.empty.title')}
                    description={t('seoOverview.empty.description')}
                    primary={{
                        label: t('seoOverview.refresh'),
                        onClick: () => void vm.refresh(),
                        testId: 'seo-overview-empty-primary-btn',
                    }}
                />
            ) : (
                <>
                    <Row gutter={16} data-testid="seo-overview-stats-row">
                        <Col xs={12} md={6}>
                            <Statistic
                                title={t('seoOverview.stats.pages')}
                                value={summary?.sitemapCounts.pages ?? 0}
                                data-testid="seo-overview-stat-pages"
                            />
                        </Col>
                        <Col xs={12} md={6}>
                            <Statistic
                                title={t('seoOverview.stats.posts')}
                                value={summary?.sitemapCounts.posts ?? 0}
                                data-testid="seo-overview-stat-posts"
                            />
                        </Col>
                        <Col xs={12} md={6}>
                            <Statistic
                                title={t('seoOverview.stats.products')}
                                value={summary?.sitemapCounts.products ?? 0}
                                data-testid="seo-overview-stat-products"
                            />
                        </Col>
                        <Col xs={12} md={6}>
                            <Statistic
                                title={t('seoOverview.stats.redirects')}
                                value={summary?.redirectCount ?? 0}
                                data-testid="seo-overview-stat-redirects"
                            />
                        </Col>
                    </Row>
                    <Row gutter={16} style={{marginTop: 16}}>
                        <Col xs={24} md={12}>
                            <Statistic
                                title={t('seoOverview.stats.ogCoverage')}
                                value={summary?.ogCoverage.pct ?? 0}
                                suffix="%"
                                data-testid="seo-overview-stat-og-coverage"
                            />
                            <Typography.Text type="secondary">
                                {t('seoOverview.stats.ogCoverageDetail', {
                                    covered: summary?.ogCoverage.covered ?? 0,
                                    total: summary?.ogCoverage.total ?? 0,
                                })}
                            </Typography.Text>
                        </Col>
                        <Col xs={24} md={12}>
                            <Statistic
                                title={t('seoOverview.stats.warnings')}
                                value={summary?.preflight.warningCount ?? 0}
                                data-testid="seo-overview-stat-warnings"
                            />
                            <Typography.Text type="secondary">
                                {summary?.generatedAt
                                    ? t('seoOverview.generatedAt', {when: new Date(summary.generatedAt).toLocaleString()})
                                    : ''}
                            </Typography.Text>
                        </Col>
                    </Row>

                    <Typography.Title level={5} style={{marginTop: 24}}>
                        {t('seoOverview.warningsTitle')}
                    </Typography.Title>
                    {warnings.length === 0 ? (
                        <Typography.Text type="success" data-testid="seo-overview-no-warnings">
                            {t('seoOverview.noWarnings')}
                        </Typography.Text>
                    ) : (
                        <Table<SeoPreflightWarning>
                            data-testid="seo-overview-warnings-table"
                            rowKey={(r) => `${r.page}-${r.field}-${r.message}`}
                            dataSource={warnings}
                            columns={columns}
                            size="small"
                            pagination={{pageSize: 25, hideOnSinglePage: true}}
                            onRow={(record) => ({
                                'data-testid': `seo-overview-warning-row-${record.page}-${record.field}`,
                            } as Record<string, string>)}
                        />
                    )}
                </>
            )}
        </Card>
    );
};

export default SeoOverviewPane;
