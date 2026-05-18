/**
 * admin-module-composed — Trash bridge.
 *
 * The `AdminLoader` bridge for `release/trash`. `TrashViewModel` is
 * unchanged ("admin stays mostly same"); the hand-coded list chrome
 * (header + Table + EmptyState) is replaced by `AdminCrudListModule`.
 * The Restore action lives in the bridge-built Actions column.
 *
 * Registered with the `AdminPageRegistry` by `TrashAdminLoader`; the
 * shell reaches it via `AdminPageDispatch` (see `TrashAdminUILoader`).
 */
import React, {useEffect} from 'react';
import {Button, Popconfirm, Space, Tag, Typography} from 'antd';
import type {ColumnsType} from 'antd/es/table';
import {useTranslation} from 'react-i18next';
import type {TrashGroupSummary} from '@services/api/client/TrashApi';
import {useRefreshView} from '@client/lib/useRefreshView';
import {useViewModel} from '@client/lib/state/observable';
import AdminCrudListModule from '@admin/modules/shapes/AdminCrudListModule';
import {TrashViewModel} from './TrashViewModel';

/** Render-only Trash admin pane — VM4 (F2 / data-integrity.md). */
const TrashPane: React.FC = () => {
    const {t} = useTranslation();
    const vm = useViewModel(() => new TrashViewModel());

    useEffect(() => { void vm.refresh(); }, [vm]);
    useRefreshView(vm.refresh, 'settings');

    const columns = [
        {
            title: t('Trash group'),
            dataIndex: 'trashGroup',
            key: 'trashGroup',
            ellipsis: true,
            render: (v: string) => (
                <Typography.Text code style={{fontSize: 11}} data-testid={`trash-group-${v}`}>{v}</Typography.Text>
            ),
        },
        {
            title: t('Contents'),
            dataIndex: 'summary',
            key: 'summary',
            render: (s: Record<string, number>, row: TrashGroupSummary) => {
                const total = Object.values(s || {}).reduce((a, b) => a + (b ?? 0), 0);
                return (
                    <Space size={4} wrap>
                        <span data-testid={`trash-group-${row.trashGroup}-child-count`} data-count={total} style={{display: 'none'}}>{total}</span>
                        {Object.entries(s || {}).map(([coll, n]) => (
                            <Tag key={coll}>{coll}: {n}</Tag>
                        ))}
                    </Space>
                );
            },
        },
        {
            title: t('Age'),
            dataIndex: 'deletedAt',
            key: 'deletedAt',
            width: 140,
            render: (v: string) => <Typography.Text type="secondary">{TrashViewModel.ageLabel(v)}</Typography.Text>,
        },
        {
            title: t('Actions'),
            key: 'actions',
            width: 140,
            render: (_: unknown, row: TrashGroupSummary) => (
                <Popconfirm
                    title={t('Restore this group?')}
                    onConfirm={() => void vm.restore(row.trashGroup)}
                    okText={t('Restore')}
                    cancelText={t('Cancel')}
                    // Stable testids on the popconfirm OK / Cancel buttons —
                    // the trash restore e2e (`tests/e2e/features/trash.spec.ts`)
                    // needs to click the inner OK reliably and AntD doesn't
                    // expose one by default. okButtonProps / cancelButtonProps
                    // are the canonical pass-through.
                    okButtonProps={{
                        ['data-testid' as never]: `trash-restore-confirm-${row.trashGroup}`,
                    }}
                    cancelButtonProps={{
                        ['data-testid' as never]: `trash-restore-cancel-${row.trashGroup}`,
                    }}
                >
                    <Button
                        size="small"
                        type="primary"
                        loading={Boolean(vm.restoring[row.trashGroup])}
                        data-testid={`trash-restore-${row.trashGroup}`}
                    >
                        {t('Restore')}
                    </Button>
                </Popconfirm>
            ),
        },
    ];

    const toolbar = (
        <Typography.Text type="secondary">
            {t('Soft-deleted rows. Auto-purged after 24h.')}
        </Typography.Text>
    );

    return (
        <AdminCrudListModule
            testId="trash-pane"
            title={t('Trash')}
            columns={columns as unknown as ColumnsType<Record<string, unknown>>}
            rows={vm.groups as unknown as ReadonlyArray<Record<string, unknown>>}
            rowKey="trashGroup"
            loading={vm.loading}
            onRefresh={() => void vm.refresh()}
            toolbar={toolbar}
            rowTestId={(row) => `trash-group-${(row as unknown as TrashGroupSummary).trashGroup}`}
            emptyState={{
                testId: 'trash-empty-state',
                title: t('empty.trash.title'),
                description: t('empty.trash.description'),
                art: 'trash',
            }}
        />
    );
};

export default TrashPane;
