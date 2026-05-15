// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ProductSpecTable from './ProductSpecTable';

describe('ProductSpecTable', () => {
    it('renders empty state with no attributes', () => {
        render(<ProductSpecTable content={{productId: 'x', autoFromAttributes: true}} attributes={{}} />);
        expect(screen.getByTestId('product-spec-table-empty')).toBeInTheDocument();
    });

    it('renders rows from attributes (humanised labels)', () => {
        render(<ProductSpecTable
            content={{productId: 'x', autoFromAttributes: true}}
            attributes={{year: '2018', fuel_type: 'petrol'}} />);
        expect(screen.getByText('Year')).toBeInTheDocument();
        expect(screen.getByText('Fuel Type')).toBeInTheDocument();
        expect(screen.getByText('2018')).toBeInTheDocument();
    });

    it('honours explicit rows when autoFromAttributes is false', () => {
        render(<ProductSpecTable content={{productId: 'x', autoFromAttributes: false, rows: [{label: 'Custom', value: 'override'}]}} />);
        expect(screen.getByText('Custom')).toBeInTheDocument();
        expect(screen.getByText('override')).toBeInTheDocument();
    });
});
