import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Button, DatePicker, Drawer, Empty, Input, Select, Space, Table, Tag, Typography, message} from 'antd';
import {useTranslation} from 'react-i18next';
import AuditApi, {AuditFilter, AuditPage} from '../../../api/AuditApi';
import type {AuditEntry, AuditOp} from '../../../../Server/AuditService';
import {useRefreshView} from '../../../lib/refreshBus';

/**
 * Site-settings → Audit tab. Lists the chronological log from the
 * `AuditLog` collection with filter controls (actor, collection, op,
 * date range) and a side drawer showing the optional diff payload.
 *
 * Admin-only gate is enforced on the server (`QUERY_REQUIREMENTS`). This
 * tab is still surfaced for viewers/editors if they navigate here
 * directly — the page will render empty + a permissions notice.
 *
 * v1 is view-only: no rollback from the audit row. The plan calls that
 * out explicitly as scope creep.
 */
const auditApi = new AuditApi();

const PAGE_SIZE = 50;

const OP_COLORS: Record<AuditOp, string> = {
    create: 'green',
    update: 'blue',
    delete: 'red',
};

const AuditTab: React.FC = () => {
    const {t} = useTranslation();
    const [page, setPage] = useState<AuditPage>({rows: [], total: 0});
    const [loading, setLoading] = useState(false);
    const [offset, setOffset] = useState(0);

    const [actor, setActor] = useState<string | undefined>(undefined);
    const [collection, setCollection] = useState<string | undefined>(undefined);
    const [op, setOp] = useState<AuditOp | undefined>(undefined);
    const [dateRange, setDateRange] = useState<[Date | null, Date | null] | null>(null);
    const [docIdFilter, setDocIdFilter] = useState('');

    const [collections, setCollections] = useState<string[]>([]);
    const [actors, setActors] = useState<string[]>([]);

    const [selected, setSelected] = useState<AuditEntry | null>(null);

    const filter: AuditFilter = useMemo(() => ({
        actorEmail: actor,
        collection,
        op,
        docId: docIdFilter.trim() || undefined,
        since: dateRange?.[0]?.toISOString(),
        until: dateRange?.[1]?.toISOString(),
        limit: PAGE_SIZE,
        offset,
    }), [actor, collection, op, docIdFilter, dateRange, offset]);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const [p, cols, acts] = await Promise.all([
                auditApi.list(filter),
                collections.length === 0 ? auditApi.listCollections() : Promise.resolve(collections),
                actors.length === 0 ? auditApi.listActors() : Promise.resolve(actors),
            ]);
            setPage(p);
            if (!collections.length) setCollections(cols);
            if (!actors.length) setActors(acts);
        } catch (err) {
            message.error(String((err as Error)?.message ?? err));
        } finally {
            setLoading(false);
        }
    }, [filter, collections, actors]);

    useEffect(() => { void refresh(); }, [refresh]);
    useRefreshView(refresh, 'settings');

    const resetFilters = () => {
        setActor(undefined);
        setCollection(undefined);
        setOp(undefined);
        setDocIdFilter('');
        setDateRange(null);
        setOffset(0);
    };

    const columns = [
        {
            title: t('When'),
            dataIndex: 'at',
            key: 'at',
            width: 170,
            render: (at: string) => {
                try { return new Date(at).toLocaleString(); } catch { return at; }
            },
        },
        {
            title: t('Actor'),
            dataIndex: ['actor', 'email'],
            key: 'actor',
            width: 220,
            render: (_: any, row: AuditEntry) => row.actor?.email ?? <Typography.Text type="secondary">—</Typography.Text>,
        },
        {
            title: t('Collection'),
            dataIndex: 'collection',
            key: 'collection',
            width: 140,
            render: (v: string) => <Tag>{v}</Tag>,
        },
        {
            title: t('Op'),
            dataIndex: 'op',
            key: 'op',
            width: 100,
            render: (v: AuditOp) => <Tag color={OP_COLORS[v] ?? 'default'}>{v}</Tag>,
        },
        {
            title: t('Doc'),
            dataIndex: 'docId',
            key: 'docId',
            ellipsis: true,
            render: (v: string) => v ? <Typography.Text code style={{fontSize: 11}}>{v}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>,
        },
        {
            title: t('Tag'),
            dataIndex: 'tag',
            key: 'tag',
            width: 120,
            render: (v?: string) => v ? <Tag color="purple">{v}</Tag> : null,
        },
    ];

    return (
        <div style={{padding: 16}}>
            <Space style={{marginBottom: 12, flexWrap: 'wrap'}} size={8}>
                <Select
                    allowClear
                    placeholder={t('Actor')}
                    style={{width: 220}}
                    value={actor}
                    onChange={v => { setActor(v); setOffset(0); }}
                    options={actors.map(a => ({label: a, value: a}))}
                    showSearch
                />
                <Select
                    allowClear
                    placeholder={t('Collection')}
                    style={{width: 180}}
                    value={collection}
                    onChange={v => { setCollection(v); setOffset(0); }}
                    options={collections.map(c => ({label: c, value: c}))}
                />
                <Select
                    allowClear
                    placeholder={t('Op')}
                    style={{width: 120}}
                    value={op}
                    onChange={v => { setOp(v); setOffset(0); }}
                    options={[
                        {label: 'create', value: 'create'},
                        {label: 'update', value: 'update'},
                        {label: 'delete', value: 'delete'},
                    ]}
                />
                <Input
                    allowClear
                    placeholder={t('Doc id')}
                    style={{width: 200}}
                    value={docIdFilter}
                    onChange={e => { setDocIdFilter(e.target.value); setOffset(0); }}
                    onPressEnter={() => void refresh()}
                />
                <DatePicker.RangePicker
                    showTime={{format: 'HH:mm'}}
                    onChange={vals => {
                        setDateRange(vals ? [vals[0]?.toDate() ?? null, vals[1]?.toDate() ?? null] : null);
                        setOffset(0);
                    }}
                />
                <Button onClick={resetFilters}>{t('Reset')}</Button>
                <Button type="primary" onClick={refresh} loading={loading}>{t('Refresh')}</Button>
            </Space>

            {page.rows.length === 0 && !loading ? (
                <Empty description={t('No audit entries')}/>
            ) : (
                <Table
                    rowKey="id"
                    loading={loading}
                    columns={columns as any}
                    dataSource={page.rows}
                    size="small"
                    scroll={{x: 'max-content'}}
                    pagination={{
                        pageSize: PAGE_SIZE,
                        current: Math.floor(offset / PAGE_SIZE) + 1,
                        total: page.total,
                        showSizeChanger: false,
                        onChange: (p) => setOffset((p - 1) * PAGE_SIZE),
                    }}
                    onRow={(row) => ({onClick: () => setSelected(row)})}
                />
            )}

            <Drawer
                width={560}
                open={Boolean(selected)}
                onClose={() => setSelected(null)}
                title={selected ? `${selected.op} · ${selected.collection} · ${selected.docId ?? '—'}` : ''}
            >
                {selected && (
                    <Space direction="vertical" size={12} style={{width: '100%'}}>
                        <Typography.Text type="secondary" style={{fontSize: 12}}>
                            {new Date(selected.at).toLocaleString()} · {selected.actor?.email ?? 'anonymous'}
                        </Typography.Text>
                        {selected.tag && <Tag color="purple">{selected.tag}</Tag>}
                        <Typography.Title level={5} style={{marginBottom: 0}}>{t('Diff')}</Typography.Title>
                        {selected.diff ? (
                            <pre style={{background: '#fafafa', padding: 12, border: '1px solid #eee', borderRadius: 4, fontSize: 12, maxHeight: '60vh', overflow: 'auto'}}>
                                {JSON.stringify(selected.diff, null, 2)}
                            </pre>
                        ) : (
                            <Typography.Text type="secondary">
                                {t('No diff captured — this mutation did not record before/after (or the diff exceeded the 10 kB cap).')}
                            </Typography.Text>
                        )}
                    </Space>
                )}
            </Drawer>
        </div>
    );
};

export default AuditTab;
