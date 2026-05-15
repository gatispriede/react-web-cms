/**
 * ProductSpecTable — Phase 1.C.
 *
 * Renders a 2-column key/value table from `IProduct.attributes`.
 * Pure renderer; product data injection lives at the page-context layer.
 */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IProductSpecTable} from './ProductSpecTable.types';

export interface ProductSpecTableProps {
    item: IItem;
    /** Test seam — inject attributes directly when used outside
     *  `ProductContext`. */
    attributes?: Record<string, string>;
}

const humanise = (k: string): string =>
    k.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function parseContent(raw: string | IProductSpecTable | undefined): IProductSpecTable {
    if (!raw) return {productId: ''};
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) as IProductSpecTable; } catch { return {productId: ''}; }
    }
    return raw;
}

const ProductSpecTable: React.FC<ProductSpecTableProps> = ({item, attributes}) => {
    const c = parseContent(item.content as string | IProductSpecTable | undefined);
    const rows: Array<{label: string; value: string}> = (() => {
        if (!c.autoFromAttributes && c.rows?.length) return c.rows;
        const attrs = attributes ?? {};
        return Object.entries(attrs).map(([k, v]) => ({label: humanise(k), value: String(v)}));
    })();

    if (rows.length === 0) {
        return (
            <div className="product-spec-table product-spec-table--empty" data-testid="product-spec-table-empty">
                <em>No specifications available.</em>
            </div>
        );
    }
    return (
        <table className="product-spec-table" data-testid="product-spec-table">
            <tbody>
                {rows.map((r, i) => (
                    <tr key={`${r.label}-${i}`} data-testid={`product-spec-row-${i}`}>
                        <th scope="row">{r.label}</th>
                        <td>{r.value}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
};

export default ProductSpecTable;
export {ProductSpecTable};
