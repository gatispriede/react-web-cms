// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import OrderDetailModule from './OrderDetailModule';
import type {OrderDetailModuleProps} from './OrderDetailModule.types';

const baseProps: OrderDetailModuleProps = {
    testId: 'ord',
    orderNumber: 'A1234',
    progressVariant: 'sale',
    progressSteps: [
        {key: 'ordered', label: 'Ordered', status: 'done'},
        {key: 'confirmed', label: 'Confirmed', status: 'active'},
        {key: 'scheduling', label: 'Scheduling', status: 'pending'},
        {key: 'delivered', label: 'Delivered', status: 'pending'},
    ],
    lineItems: [
        {sku: 'BMW-X3-2018', title: '2018 BMW X3', quantity: 1, lineTotalFormatted: 'EUR 24,500'},
        {sku: 'ACC-1', title: 'Roof rack', quantity: 2, lineTotalFormatted: 'EUR 240'},
    ],
    shippingAddress: {name: 'Jane Doe', line1: 'Brivibas 1', city: 'Riga', postalCode: 'LV-1010', country: 'LV'},
    payment: {subtotalFormatted: 'EUR 24,740', shippingFormatted: 'EUR 0', taxFormatted: 'EUR 5,195', totalFormatted: 'EUR 29,935', method: 'Visa ending 4242'},
    statusHistory: [
        {status: 'created', at: '2026-05-10T09:00:00Z'},
        {status: 'paid', at: '2026-05-10T09:05:00Z', note: 'Stripe authorisation'},
    ],
};

describe('OrderDetailModule', () => {
    it('renders order number + title', () => {
        render(<OrderDetailModule {...baseProps} />);
        expect(screen.getByTestId('ord-title').textContent).toBe('Order #A1234');
    });

    it('renders OrderProgressTimeline with the supplied steps', () => {
        render(<OrderDetailModule {...baseProps} />);
        expect(screen.getByTestId('ord-progress')).toBeInTheDocument();
        expect(screen.getByTestId('ord-progress-step-ordered')).toBeInTheDocument();
        expect(screen.getByTestId('ord-progress-step-confirmed')).toHaveAttribute('aria-current', 'step');
    });

    it('renders one line per lineItem with the correct testid', () => {
        render(<OrderDetailModule {...baseProps} />);
        expect(screen.getByTestId('ord-line-BMW-X3-2018')).toBeInTheDocument();
        expect(screen.getByTestId('ord-line-ACC-1')).toBeInTheDocument();
    });

    it('renders shipping address; hides billing when not provided', () => {
        render(<OrderDetailModule {...baseProps} />);
        expect(screen.getByTestId('ord-shipping')).toBeInTheDocument();
        expect(screen.queryByTestId('ord-billing')).toBeNull();
    });

    it('renders payment summary with subtotal/shipping/tax/total + method', () => {
        render(<OrderDetailModule {...baseProps} />);
        expect(screen.getByTestId('ord-subtotal').textContent).toBe('EUR 24,740');
        expect(screen.getByTestId('ord-total').textContent).toBe('EUR 29,935');
        expect(screen.getByTestId('ord-method').textContent).toBe('Visa ending 4242');
    });

    it('hides status-history section when statusHistory is empty', () => {
        render(<OrderDetailModule {...baseProps} statusHistory={[]} />);
        expect(screen.queryByTestId('ord-history')).toBeNull();
    });

    it('renders reorder + cancel + support buttons gated by actions flags', () => {
        const onReorder = vi.fn();
        const onCancel = vi.fn();
        const onContactSupport = vi.fn();
        render(<OrderDetailModule {...baseProps} actions={{
            canReorder: true, onReorder,
            canCancel: true, onCancel,
            onContactSupport,
        }} />);
        fireEvent.click(screen.getByTestId('ord-reorder'));
        fireEvent.click(screen.getByTestId('ord-cancel'));
        fireEvent.click(screen.getByTestId('ord-support'));
        expect(onReorder).toHaveBeenCalledOnce();
        expect(onCancel).toHaveBeenCalledOnce();
        expect(onContactSupport).toHaveBeenCalledOnce();
    });

    it('hides reorder when canReorder is false', () => {
        render(<OrderDetailModule {...baseProps} actions={{canReorder: false, onContactSupport: () => {}}} />);
        expect(screen.queryByTestId('ord-reorder')).toBeNull();
        expect(screen.getByTestId('ord-support')).toBeInTheDocument();
    });
});
