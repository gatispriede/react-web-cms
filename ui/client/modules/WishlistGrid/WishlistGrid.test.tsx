// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import WishlistGrid from './WishlistGrid';
import type {WishlistItem} from './WishlistGrid.types';

const items: WishlistItem[] = [
    {productId: 'p1', title: 'Saddle Brown Sofa', priceFormatted: 'EUR 1,299', thumbUrl: '/t1.jpg', href: '/p/p1'},
    {productId: 'p2', title: '2018 Hatch', priceFormatted: 'EUR 8,400', thumbUrl: '/t2.jpg', href: '/cars/p2', isReservation: true},
];

const noop = () => {};

describe('WishlistGrid', () => {
    it('renders the empty state with the default title when items is empty', () => {
        render(<WishlistGrid testId="wl" items={[]} onRemove={noop} onPrimaryAction={noop} />);
        expect(screen.getByTestId('wl-empty')).toBeInTheDocument();
        expect(screen.getByTestId('wl-empty-title')).toHaveTextContent('Nothing in your wishlist yet');
    });

    it('lets a custom emptyState.title override the default', () => {
        render(<WishlistGrid
            testId="wl"
            items={[]}
            onRemove={noop}
            onPrimaryAction={noop}
            emptyState={{title: 'Save items for later', description: 'They will appear here.'}}
        />);
        expect(screen.getByTestId('wl-empty-title')).toHaveTextContent('Save items for later');
        expect(screen.getByTestId('wl-empty-description')).toHaveTextContent('They will appear here.');
    });

    it('renders one row per item with the correct testids', () => {
        render(<WishlistGrid testId="wl" items={items} onRemove={noop} onPrimaryAction={noop} />);
        expect(screen.getByTestId('wl')).toBeInTheDocument();
        expect(screen.getByTestId('wl-row-p1')).toBeInTheDocument();
        expect(screen.getByTestId('wl-row-p2')).toBeInTheDocument();
    });

    it('labels the primary action "Reserve" when isReservation else "Move to cart"', () => {
        render(<WishlistGrid testId="wl" items={items} onRemove={noop} onPrimaryAction={noop} />);
        expect(screen.getByTestId('wl-primary-p1')).toHaveTextContent('Move to cart');
        expect(screen.getByTestId('wl-primary-p2')).toHaveTextContent('Reserve');
    });

    it('clicking primary calls onPrimaryAction with the item and prevents navigation', () => {
        const onPrimary = vi.fn();
        render(<WishlistGrid testId="wl" items={items} onRemove={noop} onPrimaryAction={onPrimary} />);
        const btn = screen.getByTestId('wl-primary-p1');
        const ev = new MouseEvent('click', {bubbles: true, cancelable: true});
        btn.dispatchEvent(ev);
        expect(onPrimary).toHaveBeenCalledWith(items[0]);
        expect(ev.defaultPrevented).toBe(true);
    });

    it('clicking remove calls onRemove with the productId and prevents navigation', () => {
        const onRemove = vi.fn();
        render(<WishlistGrid testId="wl" items={items} onRemove={onRemove} onPrimaryAction={noop} />);
        const btn = screen.getByTestId('wl-remove-p2');
        const ev = new MouseEvent('click', {bubbles: true, cancelable: true});
        btn.dispatchEvent(ev);
        expect(onRemove).toHaveBeenCalledWith('p2');
        expect(ev.defaultPrevented).toBe(true);
    });

    it('sets the anchor href correctly per item', () => {
        render(<WishlistGrid testId="wl" items={items} onRemove={noop} onPrimaryAction={noop} />);
        expect(screen.getByTestId('wl-link-p1').getAttribute('href')).toBe('/p/p1');
        expect(screen.getByTestId('wl-link-p2').getAttribute('href')).toBe('/cars/p2');
    });

    it('applies the columns prop as a class and data attribute', () => {
        render(<WishlistGrid testId="wl" items={items} onRemove={noop} onPrimaryAction={noop} columns={2} />);
        const grid = screen.getByTestId('wl');
        expect(grid.className).toContain('wishlist-grid--cols-2');
        expect(grid.getAttribute('data-columns')).toBe('2');
    });

    // Sanity-check: ensure fireEvent (which uses React synthetic events) still invokes the
    // callback — covers the case where preventDefault is called on the synthetic event.
    it('fires onPrimaryAction via fireEvent.click as well', () => {
        const onPrimary = vi.fn();
        render(<WishlistGrid testId="wl" items={items} onRemove={noop} onPrimaryAction={onPrimary} />);
        fireEvent.click(screen.getByTestId('wl-primary-p1'));
        expect(onPrimary).toHaveBeenCalledOnce();
    });
});
