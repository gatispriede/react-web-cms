// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import PaymentMethodList from './PaymentMethodList';
import type {PaymentMethodRow} from './PaymentMethodList.types';

const methods: PaymentMethodRow[] = [
    {id: 'p1', kind: 'card', label: 'Visa ending 4242', expiresAt: '08/2028', isDefault: true},
    {id: 'p2', kind: 'bank', label: 'IBAN ending 8901'},
    {id: 'p3', kind: 'paypal', label: 'ada@example.com'},
];

const noop = () => {};

describe('PaymentMethodList', () => {
    it('renders empty state with default title', () => {
        render(<PaymentMethodList testId="pm" methods={[]} onAdd={noop} onDelete={noop} />);
        expect(screen.getByTestId('pm-empty')).toBeInTheDocument();
        expect(screen.getByTestId('pm-empty-title')).toHaveTextContent('No saved payment methods');
    });

    it('add button fires onAdd', () => {
        const onAdd = vi.fn();
        render(<PaymentMethodList testId="pm" methods={methods} onAdd={onAdd} onDelete={noop} />);
        fireEvent.click(screen.getByTestId('pm-add'));
        expect(onAdd).toHaveBeenCalledTimes(1);
    });

    it('sets data-kind on each row', () => {
        render(<PaymentMethodList testId="pm" methods={methods} onAdd={noop} onDelete={noop} />);
        expect(screen.getByTestId('pm-row-p1').getAttribute('data-kind')).toBe('card');
        expect(screen.getByTestId('pm-row-p2').getAttribute('data-kind')).toBe('bank');
        expect(screen.getByTestId('pm-row-p3').getAttribute('data-kind')).toBe('paypal');
    });

    it('renders expiry only when set', () => {
        render(<PaymentMethodList testId="pm" methods={methods} onAdd={noop} onDelete={noop} />);
        expect(screen.getByTestId('pm-row-p1')).toHaveTextContent('08/2028');
        expect(screen.getByTestId('pm-row-p2')).not.toHaveTextContent('Expires');
    });

    it('default pill conditional on isDefault', () => {
        render(<PaymentMethodList testId="pm" methods={methods} onAdd={noop} onDelete={noop} />);
        expect(screen.getByTestId('pm-default-p1')).toBeInTheDocument();
        expect(screen.queryByTestId('pm-default-p2')).toBeNull();
    });

    it('delete and set-default fire callbacks with id', () => {
        const onDelete = vi.fn();
        const onSetDefault = vi.fn();
        render(<PaymentMethodList testId="pm" methods={methods} onAdd={noop} onDelete={onDelete} onSetDefault={onSetDefault} />);
        fireEvent.click(screen.getByTestId('pm-delete-p2'));
        fireEvent.click(screen.getByTestId('pm-set-default-p3'));
        expect(onDelete).toHaveBeenCalledWith('p2');
        expect(onSetDefault).toHaveBeenCalledWith('p3');
    });

    it('set-default hides on default row and when onSetDefault is not provided', () => {
        const {rerender} = render(<PaymentMethodList testId="pm" methods={methods} onAdd={noop} onDelete={noop} onSetDefault={noop} />);
        expect(screen.queryByTestId('pm-set-default-p1')).toBeNull();
        expect(screen.getByTestId('pm-set-default-p2')).toBeInTheDocument();
        rerender(<PaymentMethodList testId="pm" methods={methods} onAdd={noop} onDelete={noop} />);
        expect(screen.queryByTestId('pm-set-default-p2')).toBeNull();
        expect(screen.queryByTestId('pm-set-default-p3')).toBeNull();
    });
});
