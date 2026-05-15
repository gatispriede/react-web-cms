import type {VatRegime} from '@client/components/VatBadge';

export interface CarComparisonRow {
    productId: string;
    title: string;
    href: string;
    thumbUrl: string;
    priceFormatted: string;
    vatRegime: VatRegime;
    attributes: Record<string, string | number | boolean>;
}

export interface CarComparisonTableProps {
    testId: string;
    /** 2-4 cars; out-of-range counts get truncated. */
    cars: CarComparisonRow[];
    /** Row order — operator-curated subset of attribute keys to render. Each key matches a
     *  CarComparisonRow.attributes property; the label is the human-readable column. */
    attributeRows: ReadonlyArray<{key: string; label: string; unit?: string}>;
    /** Highlight cells where values differ across cars. Default true. */
    highlightDifferences?: boolean;
}
