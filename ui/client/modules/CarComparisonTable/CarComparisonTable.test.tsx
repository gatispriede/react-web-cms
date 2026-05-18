// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CarComparisonTable from './CarComparisonTable';
import type {CarComparisonRow} from './CarComparisonTable.types';

const mk = (i: number): CarComparisonRow => ({
    productId: `car-${i}`,
    title: `Car ${i}`,
    href: `/cars/car-${i}`,
    thumbUrl: `https://example.com/car-${i}.jpg`,
    priceFormatted: `EUR ${20_000 + i * 1000}`,
    vatRegime: 'standard-21',
    attributes: {mileage: 60_000 + i * 5000, fuel: 'Diesel'},
});

const rows = [
    {key: 'mileage', label: 'Mileage', unit: 'km'},
    {key: 'fuel', label: 'Fuel'},
];

describe('CarComparisonTable', () => {
    it('renders null when fewer than 2 cars supplied', () => {
        const {container} = render(<CarComparisonTable testId="cmp" cars={[mk(0)]} attributeRows={rows} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders 2-car comparison with header link + price + VAT badge per car', () => {
        render(<CarComparisonTable testId="cmp" cars={[mk(0), mk(1)]} attributeRows={rows} />);
        expect(screen.getByTestId('cmp')).toBeInTheDocument();
        expect(screen.getByTestId('cmp-header-car-0')).toBeInTheDocument();
        expect(screen.getByTestId('cmp-header-car-1')).toBeInTheDocument();
        expect(screen.getByTestId('cmp-link-car-0').getAttribute('href')).toBe('/cars/car-0');
        expect(screen.getByTestId('cmp-price-car-1').textContent).toBe('EUR 21000');
        expect(screen.getByTestId('cmp-vat-car-0')).toBeInTheDocument();
        expect(screen.getByTestId('cmp-vat-car-1')).toBeInTheDocument();
    });

    it('caps at 4 cars when more provided', () => {
        const cars = Array.from({length: 6}, (_, i) => mk(i));
        render(<CarComparisonTable testId="cmp" cars={cars} attributeRows={rows} />);
        expect(screen.getByTestId('cmp-header-car-0')).toBeInTheDocument();
        expect(screen.getByTestId('cmp-header-car-3')).toBeInTheDocument();
        expect(screen.queryByTestId('cmp-header-car-4')).toBeNull();
    });

    it('renders attribute rows with unit appended on numeric values', () => {
        render(<CarComparisonTable testId="cmp" cars={[mk(0), mk(1)]} attributeRows={rows} />);
        expect(screen.getByTestId('cmp-cell-mileage-car-0').textContent).toBe('60,000 km');
        expect(screen.getByTestId('cmp-cell-mileage-car-1').textContent).toBe('65,000 km');
    });
});
