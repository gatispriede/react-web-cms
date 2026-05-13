// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import SponsorStrip from './SponsorStrip';
import type {Sponsor} from './SponsorStrip.types';

const sponsors: Sponsor[] = [
    {key: 'p1', name: 'Plat One', logoUrl: '/p1.png', tier: 'platinum', href: 'https://p1.test'},
    {key: 'g1', name: 'Gold One', logoUrl: '/g1.png', tier: 'gold'},
    {key: 's1', name: 'Silver One', logoUrl: '/s1.png', tier: 'silver'},
];

describe('SponsorStrip', () => {
    it('renders nothing when sponsors empty', () => {
        const {container} = render(<SponsorStrip testId="ss" sponsors={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('one tier-section per non-empty tier', () => {
        render(<SponsorStrip testId="ss" sponsors={sponsors} />);
        expect(screen.getByTestId('ss-tier-platinum')).toBeInTheDocument();
        expect(screen.getByTestId('ss-tier-gold')).toBeInTheDocument();
        expect(screen.getByTestId('ss-tier-silver')).toBeInTheDocument();
        expect(screen.queryByTestId('ss-tier-bronze')).toBeNull();
    });

    it('logos render with correct alt text (sponsor name)', () => {
        render(<SponsorStrip testId="ss" sponsors={sponsors} />);
        expect(screen.getByAltText('Plat One')).toBeInTheDocument();
        expect(screen.getByAltText('Gold One')).toBeInTheDocument();
    });

    it('href wraps <img> in <a> when set', () => {
        render(<SponsorStrip testId="ss" sponsors={sponsors} />);
        const link = screen.getByTestId('ss-sponsor-p1');
        expect(link.tagName).toBe('A');
        expect(link.getAttribute('href')).toBe('https://p1.test');
        const span = screen.getByTestId('ss-sponsor-g1');
        expect(span.tagName).toBe('SPAN');
    });

    it('tierOrder override changes section order', () => {
        const {container} = render(
            <SponsorStrip testId="ss" sponsors={sponsors} tierOrder={['silver', 'gold', 'platinum']} />,
        );
        const tiers = Array.from(container.querySelectorAll('[data-testid^="ss-tier-"]'));
        expect(tiers.map(el => el.getAttribute('data-testid'))).toEqual([
            'ss-tier-silver', 'ss-tier-gold', 'ss-tier-platinum',
        ]);
    });
});
