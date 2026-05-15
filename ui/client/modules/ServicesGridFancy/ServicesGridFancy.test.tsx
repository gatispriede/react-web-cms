// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ServicesGridFancy from './ServicesGridFancy';
import type {FancyService} from './ServicesGridFancy.types';

const sample: FancyService[] = [
    {key: 'brand', title: 'Brand strategy', blurb: 'Positioning and identity work.', icon: 'B'},
    {key: 'product', title: 'Product design', blurb: 'End-to-end product thinking.', href: '/services/product'},
    {key: 'engineering', title: 'Engineering', blurb: 'Full-stack delivery.'},
];

describe('ServicesGridFancy', () => {
    it('renders nothing when services is empty', () => {
        const {container} = render(<ServicesGridFancy testId="svc" services={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders one card per service with stable testids', () => {
        render(<ServicesGridFancy testId="svc" services={sample} />);
        expect(screen.getByTestId('svc-card-brand')).toBeInTheDocument();
        expect(screen.getByTestId('svc-card-product')).toBeInTheDocument();
        expect(screen.getByTestId('svc-card-engineering')).toBeInTheDocument();
    });

    it('renders icon only when provided', () => {
        render(<ServicesGridFancy testId="svc" services={sample} />);
        expect(screen.getByTestId('svc-icon-brand')).toBeInTheDocument();
        expect(screen.queryByTestId('svc-icon-product')).toBeNull();
    });

    it('wraps title in <a> when href set', () => {
        render(<ServicesGridFancy testId="svc" services={sample} />);
        const link = screen.getByTestId('svc-link-product');
        expect(link.tagName).toBe('A');
        expect(link.getAttribute('href')).toBe('/services/product');
        expect(screen.queryByTestId('svc-link-brand')).toBeNull();
    });

    it('applies columns class', () => {
        const {rerender} = render(<ServicesGridFancy testId="svc" services={sample} columns={2} />);
        expect(screen.getByTestId('svc').className).toContain('services-grid-fancy--cols-2');
        rerender(<ServicesGridFancy testId="svc" services={sample} columns={3} />);
        expect(screen.getByTestId('svc').className).toContain('services-grid-fancy--cols-3');
    });
});
