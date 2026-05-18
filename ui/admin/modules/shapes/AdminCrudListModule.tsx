/**
 * admin-module-composed — `AdminCrudList` view shape.
 *
 * Generic CRUD list surface: title + optional Add button + filter
 * toolbar + a single AntD table whose columns the bridge builds (incl.
 * any row-actions column) + an empty state. Pure view capacity — the
 * pane's ViewModel + bespoke edit modal/drawer stay in the bridge,
 * rendered alongside this module (the established Batch-1 pattern).
 *
 * admin-information-architecture follow-up (2026-05-16): the hand-rolled
 * header row was lifted into the shared `<PaneHeader>` component. The
 * bridge's `title` / `eyebrow` / `description` props feed the title
 * block; `onAdd` / `onRefresh` / `toolbar` / `headerExtra` collapse
 * into the PaneHeader `actions` slot. Existing consumers don't need to
 * change — the prop surface is unchanged, only the rendered chrome
 * shifts to match the demonstrator panes (Footer / SystemPages /
 * Invoices / Users / Analytics / Diagnostics).
 */
import React from 'react';
import {Button, Space, Table} from 'antd';
import {PlusOutlined, ReloadOutlined} from '@client/lib/icons';
import type {ColumnsType} from 'antd/es/table';
import EmptyState from '@admin/lib/EmptyState';
import type {EmptyStateArtKey} from '@admin/lib/emptyStateArt';
import PaneHeader from '@admin/shell/PaneHeader';

export interface AdminCrudListEmptyState {
    testId: string;
    title: string;
    description?: string;
    /** Designed illustration key — see `ui/admin/lib/emptyStateArt`. */
    art?: EmptyStateArtKey;
    primary?: {label: string; onClick: () => void; testId?: string};
    /** Secondary link — e.g. an `onboardingCta(...)` deep-link or a
     *  feature-specific destination (connect warehouse, learn roles …). */
    secondary?: {label: string; onClick: () => void; testId?: string};
}

export interface AdminCrudListModuleProps {
    testId: string;
    title?: string;
    /** Small uppercase area label rendered above the title — feeds the
     *  shared `<PaneHeader>` eyebrow (e.g. "Content", "Settings"). */
    eyebrow?: string;
    /** Optional one-line context below the title — feeds the shared
     *  `<PaneHeader>` description slot. */
    description?: string;
    /** Override the testid used on the shared `<PaneHeader>` root.
     *  Defaults to `${testId}-header`. */
    paneHeaderTestId?: string;
    /** AntD column defs — the admin surface is AntD-native, so the
     *  bridge passes columns straight through (custom renderers, an
     *  Actions column, all of it). */
    columns: ColumnsType<Record<string, unknown>>;
    rows: ReadonlyArray<Record<string, unknown>>;
    rowKey: string;
    loading?: boolean;
    pageSize?: number;
    pagination?: {total: number; current: number; onChange: (page: number) => void};
    /** Filter / search controls rendered in the header row. */
    toolbar?: React.ReactNode;
    /** When set, an "Add" button is rendered in the header. */
    onAdd?: () => void;
    addLabel?: string;
    addTestId?: string;
    /** When set, a Refresh button is rendered in the header. */
    onRefresh?: () => void;
    refreshTestId?: string;
    /** Extra header-right content (audit badge, bulk actions, …). */
    headerExtra?: React.ReactNode;
    onRowClick?: (row: Record<string, unknown>) => void;
    /** Per-row `data-testid` for the table rows. */
    rowTestId?: (row: Record<string, unknown>) => string;
    /** Empty-state spec. Suppressed when `showEmptyState === false`
     *  (e.g. a search filter is active — the table renders instead). */
    emptyState?: AdminCrudListEmptyState;
    showEmptyState?: boolean;
}

const AdminCrudListModule: React.FC<AdminCrudListModuleProps> = ({
    testId,
    title,
    eyebrow,
    description,
    paneHeaderTestId,
    columns,
    rows,
    rowKey,
    loading,
    pageSize = 20,
    pagination,
    toolbar,
    onAdd,
    addLabel = 'Add',
    addTestId,
    onRefresh,
    refreshTestId,
    headerExtra,
    onRowClick,
    rowTestId,
    emptyState,
    showEmptyState,
}) => {
    const renderEmpty = emptyState
        && (showEmptyState ?? (!loading && rows.length === 0));

    const hasHeader = Boolean(title || eyebrow || description || onAdd || onRefresh || toolbar || headerExtra);
    const headerActions = (onAdd || onRefresh || toolbar || headerExtra) ? (
        <>
            {onAdd && (
                <Button
                    data-testid={addTestId}
                    type="primary"
                    icon={<PlusOutlined/>}
                    onClick={onAdd}
                >{addLabel}</Button>
            )}
            {onRefresh && (
                <Button
                    data-testid={refreshTestId}
                    icon={<ReloadOutlined/>}
                    loading={loading}
                    onClick={onRefresh}
                >Refresh</Button>
            )}
            {toolbar}
            {headerExtra}
        </>
    ) : undefined;

    return (
        <div data-testid={testId} style={{padding: 16}}>
            {hasHeader && (
                <PaneHeader
                    testId={paneHeaderTestId ?? `${testId}-header`}
                    title={title}
                    eyebrow={eyebrow}
                    description={description}
                    actions={headerActions}
                />
            )}
            {renderEmpty ? (
                <EmptyState
                    testId={emptyState.testId}
                    title={emptyState.title}
                    description={emptyState.description}
                    art={emptyState.art}
                    primary={emptyState.primary}
                    secondary={emptyState.secondary}
                />
            ) : (
                <Table
                    rowKey={rowKey}
                    size="middle"
                    loading={loading}
                    columns={columns}
                    dataSource={rows as Record<string, unknown>[]}
                    pagination={pagination
                        ? {
                            pageSize,
                            current: pagination.current,
                            total: pagination.total,
                            showSizeChanger: false,
                            onChange: pagination.onChange,
                        }
                        : {pageSize}}
                    onRow={(row) => ({
                        ...(rowTestId ? {'data-testid': rowTestId(row)} : {}),
                        ...(onRowClick ? {onClick: () => onRowClick(row)} : {}),
                    } as React.HTMLAttributes<HTMLElement>)}
                    scroll={{x: 'max-content'}}
                />
            )}
        </div>
    );
};

export default AdminCrudListModule;
export {AdminCrudListModule};
