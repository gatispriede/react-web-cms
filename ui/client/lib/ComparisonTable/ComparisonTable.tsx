import React from 'react';
import type {ComparisonColumn, ComparisonRow, ComparisonTableProps, ComparisonValue} from './ComparisonTable.types';

const EM_DASH = '—';

function isPrimitive(v: ComparisonValue | undefined): v is string | number | boolean {
    const t = typeof v;
    return t === 'string' || t === 'number' || t === 'boolean';
}

/** Build set of column keys whose value is in the minority for this row.
 *  ReactNode values are opaque (excluded from the tally and never flagged). */
function computeDiffCols(row: ComparisonRow, columns: ComparisonColumn[]): Set<string> {
    const tally = new Map<string | number | boolean, string[]>();
    for (const col of columns) {
        const v = row.values[col.key];
        if (!isPrimitive(v)) continue;
        const bucket = tally.get(v) ?? [];
        bucket.push(col.key);
        tally.set(v, bucket);
    }
    if (tally.size < 2) return new Set();
    let majoritySize = 0;
    for (const bucket of tally.values()) {
        if (bucket.length > majoritySize) majoritySize = bucket.length;
    }
    const diff = new Set<string>();
    for (const bucket of tally.values()) {
        if (bucket.length < majoritySize) {
            for (const k of bucket) diff.add(k);
        }
    }
    return diff;
}

function renderValue(v: ComparisonValue | undefined): React.ReactNode {
    if (v === undefined || v === null) return <span aria-hidden="true">{EM_DASH}</span>;
    if (typeof v === 'boolean') {
        return v
            ? <span className="comparison-table__bool comparison-table__bool--true" role="img" aria-label="Yes" />
            : <span className="comparison-table__bool comparison-table__bool--false" role="img" aria-label="No" />;
    }
    if (typeof v === 'string' || typeof v === 'number') return v;
    return v as React.ReactNode;
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({
    testId,
    caption,
    columns,
    rows,
    highlightDifferences = true,
}) => {
    return (
        <div className="comparison-table-wrap">
            <table className="comparison-table" data-testid={testId}>
                {caption ? (
                    <caption className="comparison-table__caption" data-testid={`${testId}-caption`}>
                        {caption}
                    </caption>
                ) : null}
                <thead>
                    <tr>
                        <th scope="col" className="comparison-table__corner" aria-hidden="true" />
                        {columns.map(col => (
                            <th
                                key={col.key}
                                scope="col"
                                className={
                                    'comparison-table__col'
                                    + (col.highlighted ? ' comparison-table__col--highlighted' : '')
                                }
                                data-testid={`${testId}-col-${col.key}`}
                            >
                                {col.badge ? (
                                    <span className="comparison-table__badge">{col.badge}</span>
                                ) : null}
                                <span className="comparison-table__col-label">{col.label}</span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(row => {
                        const diffCols = highlightDifferences
                            ? computeDiffCols(row, columns)
                            : new Set<string>();
                        return (
                            <React.Fragment key={row.key}>
                                {row.groupHeader ? (
                                    <tr className="comparison-table__group">
                                        <th
                                            scope="colgroup"
                                            colSpan={columns.length + 1}
                                            className="comparison-table__group-cell"
                                            data-testid={`${testId}-group-${row.key}`}
                                        >{row.groupHeader}</th>
                                    </tr>
                                ) : null}
                                <tr>
                                    <th
                                        scope="row"
                                        className="comparison-table__row-label"
                                        data-testid={`${testId}-row-${row.key}`}
                                    >{row.label}</th>
                                    {columns.map(col => {
                                        const v = row.values[col.key];
                                        const cellCls = 'comparison-table__cell'
                                            + (col.highlighted ? ' comparison-table__cell--col-highlighted' : '')
                                            + (diffCols.has(col.key) ? ' comparison-table__cell--diff' : '');
                                        return (
                                            <td
                                                key={col.key}
                                                className={cellCls}
                                                data-testid={`${testId}-cell-${row.key}-${col.key}`}
                                            >{renderValue(v)}</td>
                                        );
                                    })}
                                </tr>
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default ComparisonTable;
export {ComparisonTable};
