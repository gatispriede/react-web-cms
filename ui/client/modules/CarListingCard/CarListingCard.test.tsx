// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CarListingCard from './CarListingCard';
import type {ICarListingCard} from './CarListingCard.types';

const base: ICarListingCard = {
    productId: 'abc123',
    title: '2019 Toyota Corolla',
    priceFormatted: 'EUR 14,900',
    mileage: '62,000 km',
    fuel: 'Petrol',
    gearbox: 'manual',
    year: 2019,
    region: 'Riga',
    vatRegime: 'standard-21',
    photoCount: 12,
    thumbUrl: '/img/car.jpg',
    href: '/cars/abc123',
};

describe('CarListingCard', () => {
    it('renders required fields', () => {
        render(<CarListingCard listing={base} />);
        expect(screen.getByTestId('car-listing-abc123-title')).toHaveTextContent('2019 Toyota Corolla');
        expect(screen.getByTestId('car-listing-abc123-price')).toHaveTextContent('EUR 14,900');
        expect(screen.getByTestId('car-listing-abc123-photo-count')).toHaveTextContent('12 photos');
        expect(screen.getByText('62,000 km')).toBeInTheDocument();
        expect(screen.getByText('Petrol')).toBeInTheDocument();
        expect(screen.getByText('manual')).toBeInTheDocument();
        expect(screen.getByText('2019')).toBeInTheDocument();
        expect(screen.getByText('Riga')).toBeInTheDocument();
    });

    it('anchor has correct href + aria-label', () => {
        render(<CarListingCard listing={base} />);
        const anchor = screen.getByTestId('car-listing-abc123');
        expect(anchor.tagName).toBe('A');
        expect(anchor.getAttribute('href')).toBe('/cars/abc123');
        expect(anchor.getAttribute('aria-label')).toBe('2019 Toyota Corolla, EUR 14,900');
    });

    it('renders monthly payment when present', () => {
        render(<CarListingCard listing={{...base, monthlyPaymentEstimate: 'EUR 245/mo'}} />);
        expect(screen.getByTestId('car-listing-abc123-monthly')).toHaveTextContent('EUR 245/mo');
    });

    it('omits monthly payment when absent', () => {
        render(<CarListingCard listing={base} />);
        expect(screen.queryByTestId('car-listing-abc123-monthly')).toBeNull();
    });

    it('verified badge only renders when dealerVerified is true', () => {
        const {rerender} = render(<CarListingCard listing={base} />);
        expect(screen.queryByTestId('car-listing-abc123-badge-verified')).toBeNull();
        rerender(<CarListingCard listing={{...base, dealerVerified: true}} />);
        expect(screen.getByTestId('car-listing-abc123-badge-verified')).toHaveTextContent('Verified seller');
    });

    it('accident-free badge only renders when accidentFree is true', () => {
        const {rerender} = render(<CarListingCard listing={base} />);
        expect(screen.queryByTestId('car-listing-abc123-badge-accident-free')).toBeNull();
        rerender(<CarListingCard listing={{...base, accidentFree: true}} />);
        expect(screen.getByTestId('car-listing-abc123-badge-accident-free')).toHaveTextContent('Accident-free');
    });

    it('10+ photos badge shows when photoCount >= 10 and hides at 9', () => {
        const {rerender} = render(<CarListingCard listing={{...base, photoCount: 10}} />);
        expect(screen.getByTestId('car-listing-abc123-badge-10-photos')).toBeInTheDocument();
        rerender(<CarListingCard listing={{...base, photoCount: 9}} />);
        expect(screen.queryByTestId('car-listing-abc123-badge-10-photos')).toBeNull();
    });

    it('mounts VatBadge with the correct regime', () => {
        render(<CarListingCard listing={{...base, vatRegime: 'margin-scheme'}} />);
        expect(screen.getByTestId('vat-badge-margin-scheme')).toBeInTheDocument();
    });

    it('specs render in <dl> semantic structure', () => {
        const {container} = render(<CarListingCard listing={base} />);
        const dl = container.querySelector('dl.car-listing-card__specs');
        expect(dl).not.toBeNull();
        const dts = dl!.querySelectorAll('dt');
        const dds = dl!.querySelectorAll('dd');
        expect(dts.length).toBe(5);
        expect(dds.length).toBe(5);
        expect(dts[0].textContent).toBe('Mileage');
        expect(dds[0].textContent).toBe('62,000 km');
    });

    it('testId prefix override works', () => {
        render(<CarListingCard listing={base} testId="featured-1" />);
        expect(screen.getByTestId('featured-1')).toBeInTheDocument();
        expect(screen.getByTestId('featured-1-title')).toBeInTheDocument();
        expect(screen.getByTestId('featured-1-price')).toBeInTheDocument();
        expect(screen.queryByTestId('car-listing-abc123')).toBeNull();
    });

    it('image has loading="lazy"', () => {
        const {container} = render(<CarListingCard listing={base} />);
        const img = container.querySelector('img.car-listing-card__img');
        expect(img).not.toBeNull();
        expect(img!.getAttribute('loading')).toBe('lazy');
    });
});
