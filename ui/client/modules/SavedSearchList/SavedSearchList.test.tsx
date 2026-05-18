// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import SavedSearchList from './SavedSearchList';
import type {SavedSearch} from './SavedSearchList.types';

const searches: SavedSearch[] = [
    {id: 's1', name: 'Hatchbacks under EUR 10k', href: '/cars?q=hatch', lastResultCount: 12, lastScannedAt: '2026-05-12', cadence: 'daily'},
    {id: 's2', name: 'Saved sofas', href: '/products?q=sofa', lastResultCount: null, cadence: 'off'},
    {id: 's3', name: 'New arrivals', href: '/cars?q=new', lastResultCount: 3, cadence: 'realtime'},
];

const noop = () => {};

describe('SavedSearchList', () => {
    it('renders the empty state with the default title', () => {
        render(<SavedSearchList testId="ssl" searches={[]} onEdit={noop} onDelete={noop} />);
        expect(screen.getByTestId('ssl-empty')).toBeInTheDocument();
        expect(screen.getByTestId('ssl-empty-title')).toHaveTextContent('No saved searches');
    });

    it('renders one row per saved search', () => {
        render(<SavedSearchList testId="ssl" searches={searches} onEdit={noop} onDelete={noop} />);
        expect(screen.getByTestId('ssl-row-s1')).toBeInTheDocument();
        expect(screen.getByTestId('ssl-row-s2')).toBeInTheDocument();
        expect(screen.getByTestId('ssl-row-s3')).toBeInTheDocument();
    });

    it('sets data-cadence on the cadence chip', () => {
        render(<SavedSearchList testId="ssl" searches={searches} onEdit={noop} onDelete={noop} />);
        expect(screen.getByTestId('ssl-cadence-s1').getAttribute('data-cadence')).toBe('daily');
        expect(screen.getByTestId('ssl-cadence-s2').getAttribute('data-cadence')).toBe('off');
        expect(screen.getByTestId('ssl-cadence-s3').getAttribute('data-cadence')).toBe('realtime');
    });

    it('renders em-dash when lastResultCount is null/undefined', () => {
        render(<SavedSearchList testId="ssl" searches={searches} onEdit={noop} onDelete={noop} />);
        expect(screen.getByTestId('ssl-row-s2')).toHaveTextContent('—');
        expect(screen.getByTestId('ssl-row-s1')).toHaveTextContent('12');
    });

    it('clicking edit calls onEdit with the id and prevents navigation', () => {
        const onEdit = vi.fn();
        render(<SavedSearchList testId="ssl" searches={searches} onEdit={onEdit} onDelete={noop} />);
        const btn = screen.getByTestId('ssl-edit-s1');
        const ev = new MouseEvent('click', {bubbles: true, cancelable: true});
        btn.dispatchEvent(ev);
        expect(onEdit).toHaveBeenCalledWith('s1');
        expect(ev.defaultPrevented).toBe(true);
    });

    it('clicking delete calls onDelete with the id and prevents navigation', () => {
        const onDelete = vi.fn();
        render(<SavedSearchList testId="ssl" searches={searches} onEdit={noop} onDelete={onDelete} />);
        const btn = screen.getByTestId('ssl-delete-s2');
        const ev = new MouseEvent('click', {bubbles: true, cancelable: true});
        btn.dispatchEvent(ev);
        expect(onDelete).toHaveBeenCalledWith('s2');
        expect(ev.defaultPrevented).toBe(true);
    });

    it('sets the anchor href correctly per row', () => {
        render(<SavedSearchList testId="ssl" searches={searches} onEdit={noop} onDelete={noop} />);
        expect(screen.getByTestId('ssl-link-s1').getAttribute('href')).toBe('/cars?q=hatch');
        expect(screen.getByTestId('ssl-link-s2').getAttribute('href')).toBe('/products?q=sofa');
    });

    it('also fires onEdit via fireEvent.click', () => {
        const onEdit = vi.fn();
        render(<SavedSearchList testId="ssl" searches={searches} onEdit={onEdit} onDelete={noop} />);
        fireEvent.click(screen.getByTestId('ssl-edit-s3'));
        expect(onEdit).toHaveBeenCalledWith('s3');
    });
});
