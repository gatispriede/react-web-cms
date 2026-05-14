/**
 * admin-module-composed — `AdminInfo` view shape.
 *
 * Generic read-only admin surface: a titled Card with an optional
 * header-extra slot + filter toolbar, an error banner, and an ordered
 * list of content blocks (key/value rows, status pills, tables, or a
 * bespoke node). Pure view capacity — no ViewModel, no service calls;
 * the per-pane `AdminLoader` bridge feeds it props.
 *
 * Covers the batch-1 info surfaces: Diagnostics (key/value + pills +
 * tables), Audit log + Error log (a table block + a toolbar node).
 */
import React from 'react';
import {Card, Space, Table, Tag, Typography} from 'antd';
import type {AdminInfoBlock, AdminInfoModuleProps, AdminInfoStatus} from './AdminInfoModule.types';

const STATUS_COLOUR: Record<AdminInfoStatus, string> = {
    ok: 'green',
    warn: 'orange',
    error: 'red',
    info: 'blue',
    neutral: 'default',
};

const Block: React.FC<{block: AdminInfoBlock; testId: string}> = ({block, testId}) => {
    const blockTestId = block.testId ?? `${testId}-block`;
    let body: React.ReactNode;

    switch (block.kind) {
        case 'keyValue':
            body = block.loading
                ? <Typography.Text type="secondary">Loading…</Typography.Text>
                : (
                    <Space direction="vertical" size={4} style={{width: '100%'}}>
                        {block.rows.map((row, i) => (
                            <div key={i} data-testid={`${blockTestId}-row-${i}`}>
                                <Typography.Text strong>{row.label}:</Typography.Text>{' '}
                                {row.status
                                    ? <Tag color={STATUS_COLOUR[row.status]}>{row.value}</Tag>
                                    : <span>{row.value}</span>}
                            </div>
                        ))}
                    </Space>
                );
            break;
        case 'pills':
            body = block.pills.length === 0
                ? <Typography.Text type="secondary">{block.emptyText ?? '—'}</Typography.Text>
                : (
                    <Space wrap size={4}>
                        {block.pills.map((pill, i) => (
                            <Tag key={i} color={pill.tone ? STATUS_COLOUR[pill.tone] : undefined} data-testid={`${blockTestId}-pill-${i}`}>
                                {pill.label}
                            </Tag>
                        ))}
                    </Space>
                );
            break;
        case 'table':
            body = (
                <Table
                    rowKey={block.rowKey}
                    size="small"
                    loading={block.loading}
                    columns={block.columns}
                    dataSource={block.rows as Record<string, unknown>[]}
                    pagination={block.pagination
                        ? {
                            pageSize: block.pageSize ?? 25,
                            current: block.pagination.current,
                            total: block.pagination.total,
                            showSizeChanger: false,
                            onChange: block.pagination.onChange,
                        }
                        : (block.pageSize ? {pageSize: block.pageSize} : false)}
                    locale={block.emptyText ? {emptyText: block.emptyText} : undefined}
                    onRow={block.onRowClick ? (row) => ({onClick: () => block.onRowClick?.(row)}) : undefined}
                    scroll={{x: 'max-content'}}
                />
            );
            break;
        case 'node':
            body = block.node;
            break;
    }

    if (!block.heading) {
        return <div data-testid={blockTestId}>{body}</div>;
    }
    return (
        <Card type="inner" title={block.heading} data-testid={blockTestId}>
            {body}
        </Card>
    );
};

const AdminInfoModule: React.FC<AdminInfoModuleProps> = ({
    testId,
    title,
    error,
    lastUpdatedLabel,
    headerExtra,
    toolbar,
    blocks,
}) => {
    return (
        <div data-testid={testId} style={{padding: 16}}>
            <Card
                title={title}
                extra={
                    (lastUpdatedLabel || headerExtra) ? (
                        <Space>
                            {lastUpdatedLabel && (
                                <Typography.Text type="secondary" style={{fontSize: 12}}>
                                    {lastUpdatedLabel}
                                </Typography.Text>
                            )}
                            {headerExtra}
                        </Space>
                    ) : undefined
                }
            >
                {error && (
                    <Typography.Text type="danger" data-testid={`${testId}-error`}>{error}</Typography.Text>
                )}
                {toolbar && (
                    <div data-testid={`${testId}-toolbar`} style={{marginBottom: 12}}>{toolbar}</div>
                )}
                <Space direction="vertical" size={16} style={{width: '100%'}}>
                    {blocks.map((block, i) => (
                        <Block key={block.testId ?? i} block={block} testId={testId}/>
                    ))}
                </Space>
            </Card>
        </div>
    );
};

export default AdminInfoModule;
export {AdminInfoModule};
