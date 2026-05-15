// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import PricingTable from './PricingTable';
import type {PricingTier, PricingFeature} from './PricingTable.types';

function makeTier(key: string, overrides: Partial<PricingTier> = {}): PricingTier {
    return {
        key,
        name: `Plan ${key}`,
        monthlyPriceFormatted: `$${key}/mo`,
        annualPriceFormatted: `$${key}0/yr`,
        ctaLabel: `Pick ${key}`,
        ctaHref: `/signup/${key}`,
        ...overrides,
    };
}

const features: PricingFeature[] = [
    {key: 'seats', label: 'Seats', perTier: {a: '1', b: '5', c: '10'}},
    {key: 'support', label: 'Support', perTier: {a: false, b: true, c: true}},
];

describe('PricingTable', () => {
    it('renders 2-tier table', () => {
        render(<PricingTable testId="pt" tiers={[makeTier('a'), makeTier('b')]} features={features} />);
        expect(screen.getByTestId('pt')).toBeInTheDocument();
        expect(screen.getByTestId('pt-price-a')).toHaveTextContent('$a/mo');
        expect(screen.getByTestId('pt-price-b')).toHaveTextContent('$b/mo');
    });

    it('renders 5-tier table', () => {
        const tiers = ['a', 'b', 'c', 'd', 'e'].map(k => makeTier(k));
        render(<PricingTable testId="pt" tiers={tiers} features={features} />);
        for (const k of ['a', 'b', 'c', 'd', 'e']) {
            expect(screen.getByTestId(`pt-price-${k}`)).toBeInTheDocument();
        }
    });

    it('caps at 5 tiers when 6 supplied', () => {
        const tiers = ['a', 'b', 'c', 'd', 'e', 'f'].map(k => makeTier(k));
        render(<PricingTable testId="pt" tiers={tiers} features={features} />);
        expect(screen.queryByTestId('pt-price-f')).toBeNull();
        expect(screen.getByTestId('pt-price-e')).toBeInTheDocument();
    });

    it('billing toggle flips price text', () => {
        render(<PricingTable testId="pt" tiers={[makeTier('a'), makeTier('b')]} features={features} />);
        expect(screen.getByTestId('pt-price-a')).toHaveTextContent('$a/mo');
        fireEvent.click(screen.getByTestId('pt-toggle-annual'));
        expect(screen.getByTestId('pt-price-a')).toHaveTextContent('$a0/yr');
        fireEvent.click(screen.getByTestId('pt-toggle-monthly'));
        expect(screen.getByTestId('pt-price-a')).toHaveTextContent('$a/mo');
    });

    it('highlighted tier shows popular badge', () => {
        const tiers = [makeTier('a'), makeTier('b', {highlighted: true})];
        render(<PricingTable testId="pt" tiers={tiers} features={features} />);
        expect(screen.getByTestId('pt-popular-b')).toBeInTheDocument();
        expect(screen.queryByTestId('pt-popular-a')).toBeNull();
    });

    it('CTA hrefs render correctly', () => {
        render(<PricingTable testId="pt" tiers={[makeTier('a'), makeTier('b')]} features={features} />);
        expect(screen.getByTestId('pt-cta-a')).toHaveAttribute('href', '/signup/a');
        expect(screen.getByTestId('pt-cta-b')).toHaveAttribute('href', '/signup/b');
    });

    it('embeds ComparisonTable for features', () => {
        render(<PricingTable testId="pt" tiers={[makeTier('a'), makeTier('b')]} features={features} />);
        expect(screen.getByTestId('pt-features')).toBeInTheDocument();
        expect(screen.getByTestId('pt-features-row-seats')).toBeInTheDocument();
        expect(screen.getByTestId('pt-features-row-support')).toBeInTheDocument();
    });
});
