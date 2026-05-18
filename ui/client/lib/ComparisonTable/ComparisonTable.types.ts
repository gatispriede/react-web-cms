import type React from 'react';

export interface ComparisonColumn {
    key: string;
    label: string;
    badge?: string;
    highlighted?: boolean;
}

export type ComparisonValue = string | number | boolean | React.ReactNode;

export interface ComparisonRow {
    key: string;
    label: string;
    /** Values keyed by column.key. Missing => em-dash. */
    values: Record<string, ComparisonValue>;
    /** Group header (renders as a sticky sub-section title above this row). */
    groupHeader?: string;
}

export interface ComparisonTableProps {
    testId: string;
    caption?: string;
    columns: ComparisonColumn[];
    rows: ComparisonRow[];
    /** When true, cells whose value differs from the row's majority get a
     *  highlight class. ReactNode values are opaque and never marked.
     *  Default true. */
    highlightDifferences?: boolean;
}
