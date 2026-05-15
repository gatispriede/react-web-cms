// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import CarsList from './CarsList';
import type {ICarListingCard} from '@client/modules/CarListingCard/CarListingCard.types';
import type {CarsListFacets} from './CarsList.types';

function makeCar(productId: string): ICarListingCard {
    return {
        productId,
        title: `Car ${productId}`,
        priceFormatted: 'EUR 12,000',
        mileage: '40 000 km',
        fuel: 'petrol',
        gearbox: 'manual',
        year: 2020,
        region: 'EU',
        vatRegime: 'standard-21',
        photoCount: 8,
        thumbUrl: `/cars/${productId}.jpg`,
        href: `/cars/${productId}`,
    };
}

const facets: CarsListFacets = {
    makes: [
        {value: 'bmw', label: 'BMW', count: 12},
        {value: 'audi', label: 'Audi', count: 8},
    ],
    models: [
        {value: '3-series', label: '3 Series', count: 5},
    ],
};

describe('CarsList', () => {
    it('renders EmptyStateBlock with default title when cars empty', () => {
        const onFilterChange = vi.fn();
        render(
            <CarsList
                testId="cl"
                cars={[]}
                totalCount={0}
                filters={{}}
                facets={facets}
                onFilterChange={onFilterChange}
            />,
        );
        expect(screen.getByTestId('cl-empty')).toBeInTheDocument();
        expect(screen.getByTestId('cl-empty-title')).toHaveTextContent('No cars match your filters');
    });

    it('hides clear filters when no filter set, shows when one is set', () => {
        const onFilterChange = vi.fn();
        const cars = [makeCar('a')];
        const {rerender} = render(
            <CarsList testId="cl" cars={cars} totalCount={1} filters={{}} facets={facets} onFilterChange={onFilterChange} />,
        );
        expect(screen.queryByTestId('cl-clear-filters')).not.toBeInTheDocument();
        rerender(
            <CarsList testId="cl" cars={cars} totalCount={1} filters={{make: 'bmw'}} facets={facets} onFilterChange={onFilterChange} />,
        );
        expect(screen.getByTestId('cl-clear-filters')).toBeInTheDocument();
    });

    it('clear filters click fires onFilterChange({})', () => {
        const onFilterChange = vi.fn();
        render(
            <CarsList
                testId="cl"
                cars={[makeCar('a')]}
                totalCount={1}
                filters={{make: 'bmw'}}
                facets={facets}
                onFilterChange={onFilterChange}
            />,
        );
        fireEvent.click(screen.getByTestId('cl-clear-filters'));
        expect(onFilterChange).toHaveBeenCalledWith({});
    });

    it('fuel chip click fires onFilterChange with updated fuel value', () => {
        const onFilterChange = vi.fn();
        render(
            <CarsList
                testId="cl"
                cars={[makeCar('a')]}
                totalCount={1}
                filters={{}}
                facets={facets}
                onFilterChange={onFilterChange}
            />,
        );
        fireEvent.click(screen.getByTestId('cl-filter-fuel-diesel'));
        expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({fuel: 'diesel'}));
    });

    it('make select renders one option per facet with count visible', () => {
        const onFilterChange = vi.fn();
        render(
            <CarsList
                testId="cl"
                cars={[makeCar('a')]}
                totalCount={1}
                filters={{}}
                facets={facets}
                onFilterChange={onFilterChange}
            />,
        );
        const select = screen.getByTestId('cl-filter-make') as HTMLSelectElement;
        expect(select.querySelectorAll('option')).toHaveLength(3);
        expect(select.textContent).toContain('BMW (12)');
        expect(select.textContent).toContain('Audi (8)');
    });

    it('renders result count chip with singular and plural', () => {
        const onFilterChange = vi.fn();
        const {rerender} = render(
            <CarsList testId="cl" cars={[makeCar('a')]} totalCount={1} filters={{}} facets={facets} onFilterChange={onFilterChange} />,
        );
        expect(screen.getByTestId('cl-count')).toHaveTextContent('1 car');
        rerender(
            <CarsList testId="cl" cars={[makeCar('a'), makeCar('b')]} totalCount={2} filters={{}} facets={facets} onFilterChange={onFilterChange} />,
        );
        expect(screen.getByTestId('cl-count')).toHaveTextContent('2 cars');
    });

    it('load-more visible only when hasMore + onLoadMore', () => {
        const onFilterChange = vi.fn();
        const {rerender} = render(
            <CarsList testId="cl" cars={[makeCar('a')]} totalCount={1} filters={{}} facets={facets} onFilterChange={onFilterChange} />,
        );
        expect(screen.queryByTestId('cl-load-more')).not.toBeInTheDocument();
        rerender(
            <CarsList
                testId="cl"
                cars={[makeCar('a')]}
                totalCount={1}
                filters={{}}
                facets={facets}
                onFilterChange={onFilterChange}
                hasMore
                onLoadMore={() => {}}
            />,
        );
        expect(screen.getByTestId('cl-load-more')).toBeInTheDocument();
    });

    it('load-more click fires onLoadMore once', async () => {
        const onLoadMore = vi.fn().mockResolvedValue(undefined);
        render(
            <CarsList
                testId="cl"
                cars={[makeCar('a')]}
                totalCount={1}
                filters={{}}
                facets={facets}
                onFilterChange={vi.fn()}
                hasMore
                onLoadMore={onLoadMore}
            />,
        );
        fireEvent.click(screen.getByTestId('cl-load-more'));
        await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(1));
    });
});
