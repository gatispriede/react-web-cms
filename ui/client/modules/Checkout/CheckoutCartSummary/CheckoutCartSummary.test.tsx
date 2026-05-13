// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CheckoutCartSummary from './CheckoutCartSummary';
import {EItemType} from '@enums/EItemType';

describe('CheckoutCartSummary', () => {
    it('renders', () => {
        render(<CheckoutCartSummary item={{type: EItemType.CheckoutCartSummary, content: ''}} />);
        expect(screen.getByTestId('module-checkout-cart-summary')).toBeInTheDocument();
    });
});
