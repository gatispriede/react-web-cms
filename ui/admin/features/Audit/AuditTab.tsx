/**
 * admin-module-composed (Batch 1) — Audit log bridge.
 *
 * The `AdminLoader` bridge for `release/audit`. `AuditViewModel` is
 * unchanged ("admin stays mostly same"); this maps it onto a single
 * `AdminInfo` table block + a filter toolbar, and keeps the bespoke
 * detail Drawer rendered alongside the module. VM3 — no `useState`.
 */
import React, {useEffect} from 'react';
import {Button, DatePicker, Drawer, Input, Select, Space, Tag, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import EmptyState from '@admin/lib/EmptyState';
import {useTranslation} from 'react-i18next';
import type {AuditEntry, AuditOp} from '@services/features/Audit/AuditService';
import {useRefreshView} from '@client/lib/useRefreshView';
import {useViewModel} from '@client/lib/state/observable';
import AdminInfoModule from '@admin/modules/shapes/AdminInfoModule';
import type {AdminInfoBlock} from '@admin/modules/shapes/AdminInfoModule.types';
import {AuditViewModel} from './AuditViewModel';

const OP_COLORS: Record<AuditOp, string> = {create: 'green', update: 'blue', delete: 'red'};

const AuditTab: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new AuditViewModel());

    useEffect(() => { void vm.loadFilterOptions(); }, [vm]);
    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    const columns = [
        {title: t('When'), dataIndex: 'at', key: 'at', width: 170,
            render: (at: string) => { try { return new Date(at).toLocaleString(); } catch { return at; } }},
        {title: t('Actor'), dataIndex: ['actor', 'email'], key: 'actor', width: 220,
            render: (_: unknown, row: AuditEntry) => row.actor?.email ?? <Typography.Text type="secondary">—</Typography.Text>},
        {title: t('Collection'), dataIndex: 'collection', key: 'collection', width: 140, render: (v: string) => <Tag>{v}</Tag>},
        {title: t('Op'), dataIndex: 'op', key: 'op', width: 100, render: (v: AuditOp) => <Tag color={OP_COLORS[v] ?? 'default'}>{v}</Tag>},
        {title: t('Doc'), dataIndex: 'docId', key: 'docId', ellipsis: true,
            render: (v: string) => v ? <Typography.Text code style={{fontSize: 11}}>{v}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>},
        {title: t('Tag'), dataIndex: 'tag', key: 'tag', width: 120, render: (v?: string) => v ? <Tag color="purple">{v}</Tag> : null},
    ] as unknown as ColumnsType<Record<string, unknown>>;

    const toolbar = (
        <Space style={{flexWrap: 'wrap'}} size={8}>
            <Select
                allowClear
                placeholder={t('Actor')}
                style={{width: 220}}
                value={vm.actor}
                onChange={vm.setActor}
                options={vm.actors.map(a => ({label: a, value: a}))}
                showSearch
            />
            <Select
                allowClear
                placeholder={t('Collection')}
                style={{width: 180}}
                value={vm.collection}
                onChange={vm.setCollection}
                options={vm.collections.map(c => ({label: c, value: c}))}
            />
            <Select
                allowClear
                placeholder={t('Op')}
                style={{width: 120}}
                value={vm.op}
                onChange={vm.setOp}
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
                value={vm.docIdFilter}
                onChange={e => vm.setDocIdFilter(e.target.value)}
                onPressEnter={() => void vm.refresh()}
            />
            <DatePicker.RangePicker
                showTime={{format: 'HH:mm'}}
                onChange={vals => {
                    vm.setDateRange(vals ? [vals[0]?.toDate() ?? null, vals[1]?.toDate() ?? null] : null);
                }}
            />
            <Button onClick={vm.resetFilters}>{t('Reset')}</Button>
            <Button type="primary" onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>
        </Space>
    );

    const blocks: AdminInfoBlock[] = [
        {
            kind: 'table',
            testId: 'audit-table',
            columns,
            rows: vm.page.rows as unknown as Record<string, unknown>[],
            rowKey: 'id',
            loading: vm.loading,
            pageSize: AuditViewModel.pageSize,
            pagination: {
                total: vm.page.total,
                current: Math.floor(vm.offset / AuditViewModel.pageSize) + 1,
                onChange: (p) => vm.setOffset((p - 1) * AuditViewModel.pageSize),
            },
            onRowClick: (row) => vm.select(row as unknown as AuditEntry),
            emptyText: (
                <EmptyState
                    testId="audit-empty-state"
                    title={t('empty.audit.title')}
                    description={t('empty.audit.description')}
                    art="audit"
                />
            ),
        },
    ];

    return (
        <>
            <AdminInfoModule
                testId="admin-audit"
                title={t('Audit')}
                toolbar={toolbar}
                blocks={blocks}
            />
            <Drawer
                width={560}
                open={Boolean(vm.selected)}
                onClose={() => vm.select(null)}
                title={vm.selected ? `${vm.selected.op} · ${vm.selected.collection} · ${vm.selected.docId ?? '—'}` : ''}
            >
                {vm.selected && (
                    <Space orientation="vertical" size={12} style={{width: '100%'}}>
                        <Typography.Text type="secondary" style={{fontSize: 12}}>
                            {new Date(vm.selected.at).toLocaleString()} · {vm.selected.actor?.email ?? 'anonymous'}
                        </Typography.Text>
                        {vm.selected.tag && <Tag color="purple">{vm.selected.tag}</Tag>}
                        <Typography.Title level={5} style={{marginBottom: 0}}>{t('Diff')}</Typography.Title>
                        {vm.selected.diff ? (
                            <pre style={{background: '#fafafa', padding: 12, border: '1px solid #eee', borderRadius: 4, fontSize: 12, maxHeight: '60vh', overflow: 'auto'}}>
                                {JSON.stringify(vm.selected.diff, null, 2)}
                            </pre>
                        ) : (
                            <Typography.Text type="secondary">
                                {t('No diff captured — this mutation did not record before/after (or the diff exceeded the 10 kB cap).')}
                            </Typography.Text>
                        )}
                    </Space>
                )}
            </Drawer>
        </>
    );
};

export default AuditTab;
