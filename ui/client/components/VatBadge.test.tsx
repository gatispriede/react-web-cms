// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import VatBadge, {type VatRegime} from './VatBadge';

const CASES: Array<{regime: VatRegime; label: string}> = [
    {regime: 'private-no-vat', label: 'Private seller — no VAT'},
    {regime: 'standard-21', label: 'VAT 21% — reclaimable for businesses'},
    {regime: 'margin-scheme', label: 'Margin scheme — VAT included, not reclaimable'},
];

describe('VatBadge', () => {
    it.each(CASES)('renders %s with its label', ({regime, label}) => {
        render(<VatBadge regime={regime} />);
        expect(screen.getByTestId(`vat-badge-${regime}`)).toHaveTextContent(label);
    });

    it.each(CASES)('container has vat-badge--%s class', ({regime}) => {
        render(<VatBadge regime={regime} />);
        const el = screen.getByTestId(`vat-badge-${regime}`);
        expect(el).toHaveClass('vat-badge');
        expect(el).toHaveClass(`vat-badge--${regime}`);
    });

    it('default testid matches vat-badge-{regime}', () => {
        render(<VatBadge regime="standard-21" />);
        expect(screen.getByTestId('vat-badge-standard-21')).toBeInTheDocument();
    });

    it('custom testId override works', () => {
        render(<VatBadge regime="standard-21" testId="cart-line-vat" />);
        expect(screen.getByTestId('cart-line-vat')).toBeInTheDocument();
        expect(screen.queryByTestId('vat-badge-standard-21')).toBeNull();
    });
});
