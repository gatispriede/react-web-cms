import type {ReactNode} from 'react';
import type {ColumnsType} from 'antd/es/table';

/** Status tone for a key/value row or a pill — drives the AntD Tag colour. */
export type AdminInfoStatus = 'ok' | 'warn' | 'error' | 'info' | 'neutral';

export interface AdminInfoKeyValueRow {
    label: string;
    value: ReactNode;
    /** When set, the value is wrapped in a status Tag. */
    status?: AdminInfoStatus;
}

export interface AdminInfoPill {
    label: string;
    tone?: AdminInfoStatus;
}

/**
 * One block inside an info surface. The bridge builds these from its
 * ViewModel; the module just renders them.
 *   - `keyValue` — label/value rows (build identity, storage health …)
 *   - `pills`    — a wrap row of status Tags (cache versions, categories …)
 *   - `table`    — an AntD table (feature manifest, audit log, error log …)
 *   - `node`     — escape hatch for a bespoke fragment (filter toolbars,
 *                  detail drawers) the bridge renders itself.
 */
export type AdminInfoBlock =
    | {
        kind: 'keyValue';
        heading?: string;
        testId?: string;
        rows: AdminInfoKeyValueRow[];
        /** Renders a "Loading…" placeholder instead of rows. */
        loading?: boolean;
    }
    | {
        kind: 'pills';
        heading?: string;
        testId?: string;
        pills: AdminInfoPill[];
        /** Shown when `pills` is empty. Default '—'. */
        emptyText?: string;
    }
    | {
        kind: 'table';
        heading?: string;
        testId?: string;
        // AntD column defs — the admin surface is AntD-native, so the
        // bridge passes columns straight through (custom renderers + all).
        columns: ColumnsType<Record<string, unknown>>;
        rows: ReadonlyArray<Record<string, unknown>>;
        rowKey: string;
        loading?: boolean;
        pageSize?: number;
        emptyText?: ReactNode;
        onRowClick?: (row: Record<string, unknown>) => void;
        /** Server-paginated tables (audit log) supply this; client-paged
         *  tables (feature manifest) leave it undefined. */
        pagination?: {total: number; current: number; onChange: (page: number) => void};
    }
    | {
        kind: 'node';
        heading?: string;
        testId?: string;
        node: ReactNode;
    };

export interface AdminInfoModuleProps {
    /** Stable testid prefix. */
    testId: string;
    /** Card title. */
    title: string;
    /** Whole-surface loading flag — drives the header refresh spinner. */
    loading?: boolean;
    /** Surface-level error banner. */
    error?: string | null;
    /** e.g. "Updated: 14:32:01" — rendered in the card header. */
    lastUpdatedLabel?: string;
    /** Header-right slot — typically the Refresh button. */
    headerExtra?: ReactNode;
    /** Filter toolbar slot — rendered above the blocks. */
    toolbar?: ReactNode;
    /** Ordered content blocks. */
    blocks: AdminInfoBlock[];
}
