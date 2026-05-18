/**
 * admin-module-composed (Batch 1) — Error log bridge.
 *
 * The `AdminLoader` bridge for `system/errors`. `ErrorLogViewModel` is
 * unchanged ("admin stays mostly same"); this maps it onto a single
 * `AdminInfo` table block + a filter toolbar. VM3 — no `useState`.
 */
import React, {useEffect, useMemo} from 'react';
import {Button, Select, Space, Tag, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {useTranslation} from 'react-i18next';
import type {IErrorLog, ErrorSource, ErrorLevel} from '@interfaces/IErrorLog';
import {useViewModel} from '@client/lib/state/observable';
import EmptyState from '@admin/lib/EmptyState';
import AdminInfoModule from '@admin/modules/shapes/AdminInfoModule';
import type {AdminInfoBlock} from '@admin/modules/shapes/AdminInfoModule.types';
import {ErrorLogViewModel} from './ErrorLogViewModel';

const SOURCE_COLOUR: Record<ErrorSource, string> = {
    client: 'blue',
    admin: 'volcano',
    server: 'magenta',
    mcp: 'gold',
};
const LEVEL_COLOUR: Record<ErrorLevel, string> = {error: 'red', warn: 'orange'};

const AdminErrorLog: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new ErrorLogViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);

    const columns = useMemo(() => [
        {title: t('When'), dataIndex: 'ts', key: 'ts', width: 180,
            render: (iso: string) => <Typography.Text style={{fontFamily: 'monospace', fontSize: 12}}>{new Date(iso).toLocaleString()}</Typography.Text>},
        {title: t('Source'), dataIndex: 'source', key: 'source', width: 100,
            render: (s: ErrorSource) => <Tag color={SOURCE_COLOUR[s]}>{s}</Tag>},
        {title: t('Level'), dataIndex: 'level', key: 'level', width: 80,
            render: (l: ErrorLevel) => <Tag color={LEVEL_COLOUR[l]}>{l}</Tag>},
        {title: t('Scope'), dataIndex: 'scope', key: 'scope', width: 200,
            render: (s?: string) => s ? <Typography.Text code style={{fontSize: 12}}>{s}</Typography.Text> : '—'},
        {title: t('Message'), dataIndex: 'message', key: 'message',
            render: (m: string, row: IErrorLog) => (
                <div>
                    <div>{m}</div>
                    {row.route && <Typography.Text type="secondary" style={{fontSize: 11}}>at {row.route}</Typography.Text>}
                    {row.stack && (
                        <details style={{marginTop: 4}}>
                            <summary style={{cursor: 'pointer', fontSize: 11, color: '#888'}}>{t('stack')}</summary>
                            <pre style={{fontSize: 11, whiteSpace: 'pre-wrap', margin: '4px 0 0', maxHeight: 240, overflow: 'auto'}}>{row.stack}</pre>
                        </details>
                    )}
                </div>
            )},
        {title: t('User'), dataIndex: 'userId', key: 'userId', width: 200,
            render: (uid?: string, row?: IErrorLog) => uid ? `${uid} (${row?.userKind ?? '?'})` : '—'},
        {title: t('Build'), dataIndex: 'buildId', key: 'buildId', width: 100,
            render: (b?: string) => b ? <Typography.Text code style={{fontSize: 11}}>{b.slice(0, 8)}</Typography.Text> : '—'},
    ] as unknown as ColumnsType<Record<string, unknown>>, [t]);

    const toolbar = (
        <Space wrap>
            <Select
                allowClear
                placeholder={t('Source')}
                style={{width: 140}}
                value={vm.filters.source}
                onChange={(v) => vm.setFilter('source', v)}
                options={[
                    {value: 'client', label: 'client'},
                    {value: 'admin', label: 'admin'},
                    {value: 'server', label: 'server'},
                    {value: 'mcp', label: 'mcp'},
                ]}
            />
            <Select
                allowClear
                placeholder={t('Level')}
                style={{width: 120}}
                value={vm.filters.level}
                onChange={(v) => vm.setFilter('level', v)}
                options={[
                    {value: 'error', label: 'error'},
                    {value: 'warn', label: 'warn'},
                ]}
            />
            <Select
                placeholder={t('Limit')}
                style={{width: 100}}
                value={vm.filters.limit}
                onChange={(v) => vm.setFilter('limit', v)}
                options={[
                    {value: 50, label: '50'},
                    {value: 100, label: '100'},
                    {value: 250, label: '250'},
                    {value: 500, label: '500'},
                ]}
            />
        </Space>
    );

    const blocks: AdminInfoBlock[] = [
        {
            kind: 'table',
            testId: 'errors-table',
            columns,
            rows: vm.rows as unknown as Record<string, unknown>[],
            rowKey: 'id',
            loading: vm.loading,
            pageSize: 25,
            emptyText: (
                <EmptyState
                    testId="errors-empty-state"
                    title={t('empty.errors.title')}
                    description={t('empty.errors.description')}
                    art="errors"
                />
            ),
        },
    ];

    return (
        <AdminInfoModule
            testId="admin-error-log"
            title={t('Error log')}
            /* `suppressHydrationWarning` on the button text — react-i18next
             *  resolves the cookie-detected locale (e.g. `lv`) on the
             *  server but the client SSR-boots in `en` and re-renders
             *  after hydration. The button label is the only text in the
             *  header pre-mount; the warning is correct (text mismatch)
             *  but the result is purely cosmetic, so suppress the noisy
             *  500 rather than ship a Suspense boundary for one word.
             *  The actual fix is to thread the SSR locale into the
             *  client i18next instance — tracked as a follow-up. */
            headerExtra={<Button onClick={vm.refresh} loading={vm.loading}><span suppressHydrationWarning>{t('Refresh')}</span></Button>}
            toolbar={toolbar}
            blocks={blocks}
        />
    );
};

export default AdminErrorLog;
