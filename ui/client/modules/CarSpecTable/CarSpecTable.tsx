import React from 'react';
import {
    type CarSpecAttribute,
    type CarSpecGroup,
    type CarSpecTableProps,
    DEFAULT_GROUP_ORDER,
    GROUP_LABELS,
} from './CarSpecTable.types';
import './CarSpecTable.scss';

function formatValue(attr: CarSpecAttribute): string {
    const v = typeof attr.value === 'number' ? attr.value.toLocaleString() : attr.value;
    return attr.unit ? `${v} ${attr.unit}` : String(v);
}

const DlRows: React.FC<{testId: string; rows: CarSpecAttribute[]}> = ({testId, rows}) => (
    <dl className="car-spec-table car-spec-table--dl">
        {rows.map(attr => (
            <div key={attr.key} className="car-spec-table__row" data-testid={`${testId}-row-${attr.key}`}>
                <dt className="car-spec-table__label">{attr.label}</dt>
                <dd className="car-spec-table__value" data-testid={`${testId}-value-${attr.key}`}>{formatValue(attr)}</dd>
            </div>
        ))}
    </dl>
);

const TableRows: React.FC<{testId: string; rows: CarSpecAttribute[]}> = ({testId, rows}) => (
    <table className="car-spec-table car-spec-table--table">
        <tbody>
            {rows.map(attr => (
                <tr key={attr.key} data-testid={`${testId}-row-${attr.key}`}>
                    <th scope="row" className="car-spec-table__label">{attr.label}</th>
                    <td className="car-spec-table__value" data-testid={`${testId}-value-${attr.key}`}>{formatValue(attr)}</td>
                </tr>
            ))}
        </tbody>
    </table>
);

const CarSpecTable: React.FC<CarSpecTableProps> = ({testId, attributes, variant = 'dl', grouped = false, groupOrder}) => {
    if (attributes.length === 0) return null;

    const RowsEl = variant === 'table' ? TableRows : DlRows;

    if (!grouped) {
        return (
            <div className="car-spec-table-wrap" data-testid={testId}>
                <RowsEl testId={testId} rows={attributes} />
            </div>
        );
    }

    const order = groupOrder ?? DEFAULT_GROUP_ORDER;
    const byGroup = new Map<CarSpecGroup | 'ungrouped', CarSpecAttribute[]>();
    for (const attr of attributes) {
        const g = attr.group ?? 'ungrouped';
        const list = byGroup.get(g) ?? [];
        list.push(attr);
        byGroup.set(g, list);
    }

    const blocks: {key: string; heading: string; rows: CarSpecAttribute[]}[] = [];
    for (const g of order) {
        const rows = byGroup.get(g);
        if (rows && rows.length > 0) blocks.push({key: g, heading: GROUP_LABELS[g], rows});
    }
    const ungrouped = byGroup.get('ungrouped');
    if (ungrouped && ungrouped.length > 0) {
        blocks.push({key: 'ungrouped', heading: 'Details', rows: ungrouped});
    }

    return (
        <div className="car-spec-table-wrap car-spec-table-wrap--grouped" data-testid={testId}>
            {blocks.map(block => (
                <section key={block.key} className="car-spec-table__group">
                    <h4 className="car-spec-table__group-heading" data-testid={`${testId}-group-${block.key}`}>{block.heading}</h4>
                    <RowsEl testId={testId} rows={block.rows} />
                </section>
            ))}
        </div>
    );
};

export default CarSpecTable;
export {CarSpecTable};
export type {CarSpecAttribute, CarSpecGroup, CarSpecVariant, CarSpecTableProps} from './CarSpecTable.types';
