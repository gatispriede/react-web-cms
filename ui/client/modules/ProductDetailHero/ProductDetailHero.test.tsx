// @vitest-environment jsdom
/** ProductDetailHero — Phase 1.C smoke tests. */
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ProductDetailHero from './ProductDetailHero';

describe('ProductDetailHero', () => {
    it('renders unbound placeholder when productId missing', () => {
        render(<ProductDetailHero content={{productId: ''}} />);
        expect(screen.getByTestId('product-detail-hero-unbound')).toBeInTheDocument();
    });

    it('renders title + CTA when productId bound', () => {
        render(<ProductDetailHero content={{productId: 'prod-42'}} />);
        expect(screen.getByTestId('product-detail-hero')).toHaveAttribute('data-product-id', 'prod-42');
        expect(screen.getByTestId('product-detail-hero-cta')).toBeInTheDocument();
        expect(screen.getByTestId('product-detail-hero-vat')).toBeInTheDocument();
    });

    it('hides Buy CTA when showBuyCta=false', () => {
        render(<ProductDetailHero content={{productId: 'prod-42', showBuyCta: false}} />);
        expect(screen.queryByTestId('product-detail-hero-cta')).toBeNull();
    });
});
