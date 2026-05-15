import React from 'react';
import ComparisonTable from '@client/lib/ComparisonTable/ComparisonTable';
import type {ComparisonColumn, ComparisonRow} from '@client/lib/ComparisonTable/ComparisonTable.types';
import VatBadge from '@client/components/VatBadge';
import type {CarComparisonRow, CarComparisonTableProps} from './CarComparisonTable.types';

const MAX_CARS = 4;

const CarComparisonTable: React.FC<CarComparisonTableProps> = ({testId, cars, attributeRows, highlightDifferences = true}) => {
    if (cars.length < 2) return null;
    const capped = cars.slice(0, MAX_CARS);

    const columns: ComparisonColumn[] = capped.map((car: CarComparisonRow) => ({
        key: car.productId,
        label: car.title,
    }));

    const headerRow: ComparisonRow = {
        key: '__header',
        label: '',
        values: capped.reduce<Record<string, React.ReactNode>>((acc, car) => {
            acc[car.productId] = (
                <div className="car-comparison-table__header" data-testid={`${testId}-header-${car.productId}`}>
                    <a href={car.href} className="car-comparison-table__header-link" data-testid={`${testId}-link-${car.productId}`}>
                        <img src={car.thumbUrl} alt={car.title} loading="lazy" className="car-comparison-table__thumb" />
                        <span className="car-comparison-table__price" data-testid={`${testId}-price-${car.productId}`}>{car.priceFormatted}</span>
                    </a>
                    <VatBadge regime={car.vatRegime} testId={`${testId}-vat-${car.productId}`} />
                </div>
            );
            return acc;
        }, {}),
    };

    const attrRows: ComparisonRow[] = attributeRows.map(({key, label, unit}) => ({
        key,
        label,
        values: capped.reduce<Record<string, string | number | boolean>>((acc, car) => {
            const v = car.attributes[key];
            if (v === undefined) return acc;
            if (typeof v === 'number') {
                acc[car.productId] = unit ? `${v.toLocaleString()} ${unit}` : v;
            } else if (typeof v === 'string' && unit) {
                acc[car.productId] = `${v} ${unit}`;
            } else {
                acc[car.productId] = v;
            }
            return acc;
        }, {}),
    }));

    return (
        <ComparisonTable
            testId={testId}
            caption="Vehicle comparison"
            columns={columns}
            rows={[headerRow, ...attrRows]}
            highlightDifferences={highlightDifferences}
        />
    );
};

export default CarComparisonTable;
export {CarComparisonTable};
export type {CarComparisonRow, CarComparisonTableProps} from './CarComparisonTable.types';
