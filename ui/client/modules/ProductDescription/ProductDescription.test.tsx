// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ProductDescription from './ProductDescription';

describe('ProductDescription', () => {
    it('renders empty placeholder when no body', () => {
        render(<ProductDescription content={{productId: 'x'}} />);
        expect(screen.getByTestId('product-description-empty')).toBeInTheDocument();
    });

    it('renders operator override body', () => {
        render(<ProductDescription content={{productId: 'x', body: 'hand-written copy'}} />);
        expect(screen.getByText('hand-written copy')).toBeInTheDocument();
    });

    it('falls back to injected description prop', () => {
        render(<ProductDescription content={{productId: 'x'}} description="auto-bound" />);
        expect(screen.getByText('auto-bound')).toBeInTheDocument();
    });
});
