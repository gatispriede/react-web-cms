import React, {useEffect, useMemo} from 'react';
import {Button, Card, Select, Space, Table, Tag, Typography} from 'antd';
import {useTranslation} from 'react-i18next';
import type {IErrorLog, ErrorSource, ErrorLevel} from '@interfaces/IErrorLog';
import {useViewModel} from '@client/lib/state/observable';
import EmptyState from '@admin/lib/EmptyState';
import {ErrorLogViewModel} from './ErrorLogViewModel';

/** Render-only ErrorLog pane — VM3 (2026-05-02). */

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
    ], [t]);

    return (
        <div style={{padding: 16}}>
            <Card title={t('Error log')} extra={<Button onClick={vm.refresh} loading={vm.loading}>{t('Refresh')}</Button>}>
                <Space wrap style={{marginBottom: 12}}>
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
                <Table<IErrorLog>
                    rowKey="id"
                    size="small"
                    loading={vm.loading}
                    dataSource={vm.rows}
                    columns={columns as any}
                    pagination={{pageSize: 25}}
                    locale={{
                        emptyText: (
                            <EmptyState
                                testId="errors-empty-state"
                                title={t('empty.errors.title')}
                                description={t('empty.errors.description')}
                            />
                        ),
                    }}
                />
            </Card>
        </div>
    );
};

export default AdminErrorLog;
