// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import AccountDashboardGrid from './AccountDashboardGrid';
import type {AccountDashboardCard} from './AccountDashboardGrid.types';

const sample: AccountDashboardCard[] = [
    {key: 'orders', label: 'Orders', href: '/account/orders', count: 3, helper: 'last order yesterday'},
    {key: 'wishlist', label: 'Wishlist', href: '/account/wishlist', count: 5},
    {key: 'searches', label: 'Saved searches', href: '/account/searches'},
];

describe('AccountDashboardGrid', () => {
    it('renders nothing when cards is empty', () => {
        const {container} = render(<AccountDashboardGrid testId="acc" cards={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders one card per item with stable testids', () => {
        render(<AccountDashboardGrid testId="acc" cards={sample} />);
        expect(screen.getByTestId('acc-card-orders')).toBeInTheDocument();
        expect(screen.getByTestId('acc-card-wishlist')).toBeInTheDocument();
        expect(screen.getByTestId('acc-card-searches')).toBeInTheDocument();
    });

    it('renders count only when count is a number', () => {
        render(<AccountDashboardGrid testId="acc" cards={sample} />);
        expect(screen.getByTestId('acc-count-orders').textContent).toBe('3');
        expect(screen.getByTestId('acc-count-wishlist').textContent).toBe('5');
        expect(screen.queryByTestId('acc-count-searches')).toBeNull();
    });

    it('renders helper text when provided', () => {
        render(<AccountDashboardGrid testId="acc" cards={sample} />);
        expect(screen.getByTestId('acc-helper-orders')).toHaveTextContent('last order yesterday');
        expect(screen.queryByTestId('acc-helper-wishlist')).toBeNull();
    });

    it('renders icon when provided', () => {
        render(<AccountDashboardGrid testId="acc" cards={[
            {key: 'orders', label: 'Orders', href: '/account/orders', icon: '*'},
        ]} />);
        expect(screen.getByTestId('acc-icon-orders')).toBeInTheDocument();
    });

    it('anchor href correct per card', () => {
        render(<AccountDashboardGrid testId="acc" cards={sample} />);
        const link = screen.getByTestId('acc-card-orders').querySelector('a');
        expect(link?.getAttribute('href')).toBe('/account/orders');
    });

    it('default aria-label is "Account dashboard"; override prop wins', () => {
        const {rerender} = render(<AccountDashboardGrid testId="acc" cards={sample} />);
        expect(screen.getByTestId('acc').getAttribute('aria-label')).toBe('Account dashboard');
        rerender(<AccountDashboardGrid testId="acc" cards={sample} ariaLabel="Klients" />);
        expect(screen.getByTestId('acc').getAttribute('aria-label')).toBe('Klients');
    });
});
