// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import CarVehicleDetailPage from './CarVehicleDetailPage';
import type {CarVehicleDetailPageProps} from './CarVehicleDetailPage.types';

const baseProps: CarVehicleDetailPageProps = {
    testId: 'vdp',
    productId: 'car-1',
    title: '2018 BMW X3',
    priceFormatted: 'EUR 24,500',
    monthlyPaymentEstimate: 'EUR 245/mo est.',
    vatRegime: 'standard-21',
    photos: Array.from({length: 4}, (_, i) => ({url: `https://example.com/p-${i}.jpg`, alt: `Photo ${i}`})),
    keyStats: [
        {key: 'mileage', label: 'Mileage', value: '62,000 km'},
        {key: 'year', label: 'Year', value: '2018'},
        {key: 'fuel', label: 'Fuel', value: 'Diesel'},
        {key: 'gearbox', label: 'Gearbox', value: 'Automatic'},
    ],
    specs: [
        {key: 'vin', label: 'VIN', value: 'WBADT43473GY12345', group: 'identity'},
        {key: 'engine-size', label: 'Engine size', value: 2.0, unit: 'L', group: 'engine'},
    ],
    trust: [
        {key: 'history', label: 'History report', value: 'CarVertical 12 records'},
        {key: 'accident-free', label: 'Accident-free'},
    ],
    reservation: {state: 'available', depositFormatted: 'EUR 500 deposit', onReserve: vi.fn(), onContact: vi.fn()},
    similar: [
        {productId: 'car-2', title: '2019 BMW X3', priceFormatted: 'EUR 27,000', mileage: '45,000 km', fuel: 'Diesel', gearbox: 'automatic', year: 2019, region: 'Riga', vatRegime: 'standard-21', photoCount: 12, thumbUrl: 'https://example.com/c2.jpg', href: '/cars/car-2'},
    ],
};

describe('CarVehicleDetailPage', () => {
    it('renders title + price + monthly + VAT badge', () => {
        render(<CarVehicleDetailPage {...baseProps} />);
        expect(screen.getByTestId('vdp-title').textContent).toBe('2018 BMW X3');
        expect(screen.getByTestId('vdp-price').textContent).toBe('EUR 24,500');
        expect(screen.getByTestId('vdp-monthly').textContent).toBe('EUR 245/mo est.');
        expect(screen.getByTestId('vdp-vat')).toBeInTheDocument();
    });

    it('renders the photo gallery + hero image', () => {
        render(<CarVehicleDetailPage {...baseProps} />);
        expect(screen.getByTestId('vdp-gallery')).toBeInTheDocument();
        expect(screen.getByTestId('vdp-gallery-hero')).toBeInTheDocument();
    });

    it('renders key stats with stable testids', () => {
        render(<CarVehicleDetailPage {...baseProps} />);
        expect(screen.getByTestId('vdp-stat-mileage')).toHaveTextContent('62,000 km');
        expect(screen.getByTestId('vdp-stat-year')).toHaveTextContent('2018');
    });

    it('renders the grouped spec table when specs supplied', () => {
        render(<CarVehicleDetailPage {...baseProps} />);
        expect(screen.getByTestId('vdp-specs')).toBeInTheDocument();
        expect(screen.getByTestId('vdp-specs-row-vin')).toBeInTheDocument();
    });

    it('hides the specs section when specs is empty', () => {
        render(<CarVehicleDetailPage {...baseProps} specs={[]} />);
        expect(screen.queryByTestId('vdp-specs-section')).toBeNull();
    });

    it('renders trust items', () => {
        render(<CarVehicleDetailPage {...baseProps} />);
        expect(screen.getByTestId('vdp-trust-history')).toBeInTheDocument();
        expect(screen.getByTestId('vdp-trust-accident-free')).toBeInTheDocument();
    });

    it('hides similar section when no similar listings', () => {
        render(<CarVehicleDetailPage {...baseProps} similar={[]} />);
        expect(screen.queryByTestId('vdp-similar')).toBeNull();
    });

    it('renders similar listings up to the 4-cap', () => {
        const many = Array.from({length: 6}, (_, i) => ({
            productId: `car-extra-${i}`,
            title: `Extra ${i}`,
            priceFormatted: 'EUR 1000',
            mileage: '50,000 km',
            fuel: 'Diesel',
            gearbox: 'manual' as const,
            year: 2010 + i,
            region: 'Riga',
            vatRegime: 'standard-21' as const,
            photoCount: 5,
            thumbUrl: 'https://example.com/x.jpg',
            href: `/cars/extra-${i}`,
        }));
        render(<CarVehicleDetailPage {...baseProps} similar={many} />);
        expect(screen.getByTestId('vdp-similar-car-extra-0')).toBeInTheDocument();
        expect(screen.getByTestId('vdp-similar-car-extra-3')).toBeInTheDocument();
        expect(screen.queryByTestId('vdp-similar-car-extra-4')).toBeNull();
    });

    it('mounts BOTH desktop sidebar reservation + mobile sticky reservation', () => {
        render(<CarVehicleDetailPage {...baseProps} />);
        expect(screen.getByTestId('vdp-reservation')).toBeInTheDocument();
        expect(screen.getByTestId('vdp-reservation-mobile')).toBeInTheDocument();
    });
});
