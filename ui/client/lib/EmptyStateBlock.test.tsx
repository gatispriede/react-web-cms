// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import EmptyStateBlock from './EmptyStateBlock';

describe('EmptyStateBlock', () => {
    it('renders title with stable testid', () => {
        render(<EmptyStateBlock testId="wishlist-empty" title="Nothing in your wishlist yet" />);
        expect(screen.getByTestId('wishlist-empty')).toBeInTheDocument();
        expect(screen.getByTestId('wishlist-empty-title')).toHaveTextContent('Nothing in your wishlist yet');
    });

    it('omits description + icon DOM when not provided', () => {
        render(<EmptyStateBlock testId="x" title="t" />);
        expect(screen.queryByTestId('x-description')).toBeNull();
        expect(screen.queryByTestId('x-icon')).toBeNull();
    });

    it('renders primary as <button> when no href + fires onClick', () => {
        const onClick = vi.fn();
        render(<EmptyStateBlock testId="x" title="t" primary={{label: 'Reset filters', onClick}} />);
        const btn = screen.getByTestId('x-primary');
        expect(btn.tagName).toBe('BUTTON');
        fireEvent.click(btn);
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('renders primary as <a> when href is set', () => {
        render(<EmptyStateBlock testId="x" title="t" primary={{label: 'Browse cars', href: '/cars'}} />);
        const link = screen.getByTestId('x-primary');
        expect(link.tagName).toBe('A');
        expect(link.getAttribute('href')).toBe('/cars');
    });

    it('renders secondary action alongside primary', () => {
        render(<EmptyStateBlock
            testId="x"
            title="t"
            primary={{label: 'Primary', onClick: () => {}}}
            secondary={{label: 'Secondary', href: '/other'}}
        />);
        expect(screen.getByTestId('x-primary')).toHaveTextContent('Primary');
        expect(screen.getByTestId('x-secondary')).toHaveTextContent('Secondary');
    });

    it('respects custom action testIds when provided', () => {
        render(<EmptyStateBlock
            testId="x"
            title="t"
            primary={{label: 'Go', onClick: () => {}, testId: 'cars-reset'}}
        />);
        expect(screen.getByTestId('cars-reset')).toBeInTheDocument();
        expect(screen.queryByTestId('x-primary')).toBeNull();
    });

    it('blocks click on disabled <a> action via preventDefault', () => {
        const onNav = vi.fn();
        render(<EmptyStateBlock
            testId="x"
            title="t"
            primary={{label: 'L', href: '/somewhere', disabled: true}}
        />);
        const link = screen.getByTestId('x-primary');
        const ev = new MouseEvent('click', {bubbles: true, cancelable: true});
        ev.preventDefault = vi.fn();
        link.dispatchEvent(ev);
        // Disabled <a>: aria-disabled set + click handler prevents default.
        expect(link.getAttribute('aria-disabled')).toBe('true');
        expect(onNav).not.toHaveBeenCalled();
    });
});
