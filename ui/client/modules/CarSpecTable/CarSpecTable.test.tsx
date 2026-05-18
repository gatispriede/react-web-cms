// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CarSpecTable from './CarSpecTable';
import type {CarSpecAttribute} from './CarSpecTable.types';

const sample: CarSpecAttribute[] = [
    {key: 'vin', label: 'VIN', value: 'WBADT43473GY12345', group: 'identity'},
    {key: 'mileage', label: 'Mileage', value: 62000, unit: 'km', group: 'history'},
    {key: 'engine-size', label: 'Engine size', value: 2.0, unit: 'L', group: 'engine'},
    {key: 'region', label: 'Region', value: 'Riga', group: 'location'},
    {key: 'colour', label: 'Colour', value: 'Silver'},
];

describe('CarSpecTable', () => {
    it('renders nothing when attributes is empty', () => {
        const {container} = render(<CarSpecTable testId="spec" attributes={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('dl variant emits dl with dt/dd', () => {
        const {container} = render(<CarSpecTable testId="spec" attributes={sample} />);
        expect(container.querySelector('dl.car-spec-table--dl')).not.toBeNull();
        expect(container.querySelectorAll('dt').length).toBeGreaterThan(0);
        expect(container.querySelectorAll('dd').length).toBeGreaterThan(0);
    });

    it('table variant emits table with th scope=row', () => {
        const {container} = render(<CarSpecTable testId="spec" attributes={sample} variant="table" />);
        expect(container.querySelector('table.car-spec-table--table')).not.toBeNull();
        const ths = container.querySelectorAll('th[scope="row"]');
        expect(ths.length).toBe(sample.length);
    });

    it('unit appended after value when present', () => {
        render(<CarSpecTable testId="spec" attributes={sample} />);
        expect(screen.getByTestId('spec-value-mileage').textContent).toBe('62,000 km');
        expect(screen.getByTestId('spec-value-engine-size').textContent).toBe('2 L');
    });

    it('number gets thousands separator', () => {
        render(<CarSpecTable testId="spec" attributes={[{key: 'price', label: 'Price', value: 24500}]} />);
        expect(screen.getByTestId('spec-value-price').textContent).toBe('24,500');
    });

    it('grouped=true emits group headings in default order', () => {
        render(<CarSpecTable testId="spec" attributes={sample} grouped />);
        const headings = screen.getAllByRole('heading', {level: 4}).map(h => h.textContent);
        // identity, engine, history, location present; body not present; ungrouped colour as 'Details' last.
        expect(headings).toEqual(['Identity', 'Engine', 'History', 'Location', 'Details']);
    });

    it('groupOrder override changes group order', () => {
        render(<CarSpecTable testId="spec" attributes={sample} grouped groupOrder={['location', 'identity', 'engine', 'history']} />);
        const headings = screen.getAllByRole('heading', {level: 4}).map(h => h.textContent);
        expect(headings).toEqual(['Location', 'Identity', 'Engine', 'History', 'Details']);
    });

    it('testid-row + testid-value correct per attribute', () => {
        render(<CarSpecTable testId="spec" attributes={sample} />);
        for (const attr of sample) {
            expect(screen.getByTestId(`spec-row-${attr.key}`)).toBeInTheDocument();
            expect(screen.getByTestId(`spec-value-${attr.key}`)).toBeInTheDocument();
        }
    });
});
