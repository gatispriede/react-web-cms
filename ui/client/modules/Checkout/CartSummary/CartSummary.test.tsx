// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CartSummary from './CartSummary';
import {EItemType} from '@enums/EItemType';

describe('CartSummary', () => {
    it('renders with empty content', () => {
        render(<CartSummary item={{type: EItemType.CartSummary, content: ''}} />);
        expect(screen.getByTestId('module-cart-summary')).toBeInTheDocument();
    });
});
