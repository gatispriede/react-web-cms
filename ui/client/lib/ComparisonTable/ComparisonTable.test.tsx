// @vitest-environment jsdom
import React from 'react';
import {render, screen, within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ComparisonTable from './ComparisonTable';
import type {ComparisonColumn, ComparisonRow} from './ComparisonTable.types';

const baseCols: ComparisonColumn[] = [
    {key: 'a', label: 'Plan A'},
    {key: 'b', label: 'Plan B', badge: 'Most popular', highlighted: true},
];

describe('ComparisonTable', () => {
    it('renders table with caption when provided', () => {
        render(<ComparisonTable
            testId="cmp"
            caption="Plan comparison"
            columns={baseCols}
            rows={[]}
        />);
        expect(screen.getByTestId('cmp')).toBeInTheDocument();
        expect(screen.getByTestId('cmp-caption')).toHaveTextContent('Plan comparison');
        expect(screen.getByTestId('cmp').tagName).toBe('TABLE');
    });

    it('renders column headers + row headers with correct testids', () => {
        const rows: ComparisonRow[] = [
            {key: 'price', label: 'Price', values: {a: '$10', b: '$20'}},
        ];
        render(<ComparisonTable testId="cmp" columns={baseCols} rows={rows} />);
        expect(screen.getByTestId('cmp-col-a')).toHaveTextContent('Plan A');
        expect(screen.getByTestId('cmp-col-b')).toHaveTextContent('Plan B');
        expect(screen.getByTestId('cmp-row-price')).toHaveTextContent('Price');
        expect(screen.getByTestId('cmp-cell-price-a')).toHaveTextContent('$10');
        expect(screen.getByTestId('cmp-cell-price-b')).toHaveTextContent('$20');
    });

    it('renders boolean true as checkmark with accessible name, false as em-dash glyph', () => {
        const rows: ComparisonRow[] = [
            {key: 'support', label: 'Support', values: {a: true, b: false}},
        ];
        render(<ComparisonTable testId="cmp" columns={baseCols} rows={rows} />);
        const trueCell = screen.getByTestId('cmp-cell-support-a');
        const falseCell = screen.getByTestId('cmp-cell-support-b');
        expect(within(trueCell).getByLabelText('Yes')).toBeInTheDocument();
        expect(within(falseCell).getByLabelText('No')).toBeInTheDocument();
        expect(within(trueCell).getByLabelText('Yes').className).toMatch(/comparison-table__bool--true/);
        expect(within(falseCell).getByLabelText('No').className).toMatch(/comparison-table__bool--false/);
    });

    it('renders ReactNode value verbatim', () => {
        const rows: ComparisonRow[] = [
            {key: 'cta', label: 'Get started', values: {
                a: <a href="/a" data-testid="cta-a">Pick A</a>,
                b: <a href="/b" data-testid="cta-b">Pick B</a>,
            }},
        ];
        render(<ComparisonTable testId="cmp" columns={baseCols} rows={rows} />);
        expect(screen.getByTestId('cta-a')).toHaveAttribute('href', '/a');
        expect(screen.getByTestId('cta-b')).toHaveTextContent('Pick B');
    });

    it('applies comparison-table__col--highlighted to highlighted columns', () => {
        render(<ComparisonTable testId="cmp" columns={baseCols} rows={[]} />);
        expect(screen.getByTestId('cmp-col-a').className).not.toMatch(/--highlighted/);
        expect(screen.getByTestId('cmp-col-b').className).toMatch(/comparison-table__col--highlighted/);
    });

    it('marks minority cells with __cell--diff across a 3-column row', () => {
        const cols: ComparisonColumn[] = [
            {key: 'x', label: 'X'},
            {key: 'y', label: 'Y'},
            {key: 'z', label: 'Z'},
        ];
        const rows: ComparisonRow[] = [
            {key: 'feat', label: 'Feature', values: {x: 'yes', y: 'yes', z: 'no'}},
        ];
        render(<ComparisonTable testId="cmp" columns={cols} rows={rows} highlightDifferences />);
        expect(screen.getByTestId('cmp-cell-feat-x').className).not.toMatch(/--diff/);
        expect(screen.getByTestId('cmp-cell-feat-y').className).not.toMatch(/--diff/);
        expect(screen.getByTestId('cmp-cell-feat-z').className).toMatch(/comparison-table__cell--diff/);
    });

    it('renders em-dash glyph when a column key is missing from the values record', () => {
        const rows: ComparisonRow[] = [
            {key: 'r', label: 'Row', values: {a: 'present'}},
        ];
        render(<ComparisonTable testId="cmp" columns={baseCols} rows={rows} />);
        const cell = screen.getByTestId('cmp-cell-r-b');
        expect(cell).toHaveTextContent('—');
    });

    it('renders groupHeader above its data row', () => {
        const rows: ComparisonRow[] = [
            {key: 'first', label: 'Price', values: {a: 1, b: 2}, groupHeader: 'Pricing'},
        ];
        render(<ComparisonTable testId="cmp" columns={baseCols} rows={rows} />);
        const group = screen.getByTestId('cmp-group-first');
        expect(group).toHaveTextContent('Pricing');
        expect(group.tagName).toBe('TH');
        // group <tr> precedes the row <th>'s parent <tr>
        const groupTr = group.closest('tr')!;
        const rowTr = screen.getByTestId('cmp-row-first').closest('tr')!;
        expect(groupTr.compareDocumentPosition(rowTr) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
});
