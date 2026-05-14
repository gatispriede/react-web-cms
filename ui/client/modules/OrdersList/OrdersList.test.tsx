// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import OrdersList from './OrdersList';
import type {OrderListRow} from './OrdersList.types';

const orders: OrderListRow[] = [
    {id: 'o1', orderNumber: 'A-1001', placedAt: '2026-05-10', status: 'shipped', totalFormatted: 'EUR 120.00', itemCount: 2, href: '/account/orders/o1'},
    {id: 'o2', orderNumber: 'A-1002', placedAt: '2026-05-12', status: 'delivered', totalFormatted: 'EUR 49.00', itemCount: 1, href: '/account/orders/o2'},
    {id: 'o3', orderNumber: 'A-1003', placedAt: '2026-04-30', status: 'cancelled', totalFormatted: 'EUR 0.00', itemCount: 3, href: '/account/orders/o3'},
];

describe('OrdersList', () => {
    it('renders empty state with default title', () => {
        render(<OrdersList testId="ol" orders={[]} />);
        expect(screen.getByTestId('ol-empty')).toBeInTheDocument();
        expect(screen.getByTestId('ol-empty-title')).toHaveTextContent('No orders yet');
    });

    it('renders filter chips with data-status and aria-pressed', () => {
        render(<OrdersList testId="ol" orders={orders} activeStatus="shipped" />);
        const allChip = screen.getByTestId('ol-filter-all');
        const shippedChip = screen.getByTestId('ol-filter-shipped');
        expect(allChip.getAttribute('data-status')).toBe('all');
        expect(allChip.getAttribute('aria-pressed')).toBe('false');
        expect(shippedChip.getAttribute('aria-pressed')).toBe('true');
    });

    it('fires onStatusChange when chip clicked', () => {
        const onStatusChange = vi.fn();
        render(<OrdersList testId="ol" orders={orders} onStatusChange={onStatusChange} />);
        fireEvent.click(screen.getByTestId('ol-filter-delivered'));
        expect(onStatusChange).toHaveBeenCalledWith('delivered');
    });

    it('renders one row per order with correct testids', () => {
        render(<OrdersList testId="ol" orders={orders} />);
        expect(screen.getByTestId('ol-row-o1')).toBeInTheDocument();
        expect(screen.getByTestId('ol-row-o2')).toBeInTheDocument();
        expect(screen.getByTestId('ol-row-o3')).toBeInTheDocument();
    });

    it('status pill carries data-status', () => {
        render(<OrdersList testId="ol" orders={orders} />);
        expect(screen.getByTestId('ol-status-o1').getAttribute('data-status')).toBe('shipped');
        expect(screen.getByTestId('ol-status-o2').getAttribute('data-status')).toBe('delivered');
    });

    it('renders date via locale formatting', () => {
        render(<OrdersList testId="ol" orders={orders} />);
        const row = screen.getByTestId('ol-row-o1');
        expect(row.textContent).toMatch(/[\/-]/);
    });

    it('sets the anchor href per row', () => {
        render(<OrdersList testId="ol" orders={orders} />);
        expect(screen.getByTestId('ol-link-o1').getAttribute('href')).toBe('/account/orders/o1');
        expect(screen.getByTestId('ol-link-o2').getAttribute('href')).toBe('/account/orders/o2');
    });
});
