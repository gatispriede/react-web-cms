// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ProductScreenshotHero from './ProductScreenshotHero';

const base = {
    testId: 'psh',
    headline: 'Ship faster',
    screenshotUrl: '/shot.png',
    screenshotAlt: 'Product UI',
    primaryCta: {label: 'Start', href: '/signup'},
};

describe('ProductScreenshotHero', () => {
    it('renders required props', () => {
        render(<ProductScreenshotHero {...base} />);
        expect(screen.getByTestId('psh')).toBeInTheDocument();
        expect(screen.getByTestId('psh-headline')).toHaveTextContent('Ship faster');
        expect(screen.getByTestId('psh-screenshot')).toHaveAttribute('src', '/shot.png');
        expect(screen.getByTestId('psh-screenshot')).toHaveAttribute('alt', 'Product UI');
    });

    it('secondaryCta is conditional', () => {
        const {rerender} = render(<ProductScreenshotHero {...base} />);
        expect(screen.queryByTestId('psh-secondary-cta')).toBeNull();
        rerender(<ProductScreenshotHero {...base} secondaryCta={{label: 'Demo', href: '/demo'}} />);
        expect(screen.getByTestId('psh-secondary-cta')).toHaveAttribute('href', '/demo');
    });

    it('primary-cta has correct href', () => {
        render(<ProductScreenshotHero {...base} />);
        expect(screen.getByTestId('psh-primary-cta')).toHaveAttribute('href', '/signup');
    });

    it('sub render conditional', () => {
        const {rerender} = render(<ProductScreenshotHero {...base} />);
        expect(screen.queryByTestId('psh-sub')).toBeNull();
        rerender(<ProductScreenshotHero {...base} subHeadline="Tagline" />);
        expect(screen.getByTestId('psh-sub')).toHaveTextContent('Tagline');
    });

    it('reduced-motion class flag applied via forceReducedMotion', () => {
        render(<ProductScreenshotHero {...base} forceReducedMotion />);
        const root = screen.getByTestId('psh');
        expect(root.className).toMatch(/product-screenshot-hero--reduced/);
        expect(root).toHaveAttribute('data-reduced-motion', 'true');
    });
});
