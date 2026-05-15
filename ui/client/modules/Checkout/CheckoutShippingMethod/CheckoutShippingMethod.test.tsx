// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CheckoutShippingMethod from './CheckoutShippingMethod';
import {EItemType} from '@enums/EItemType';

describe('CheckoutShippingMethod', () => {
    it('renders empty state when no orderId is on the machine', () => {
        render(<CheckoutShippingMethod item={{type: EItemType.CheckoutShippingMethod, content: ''}} />);
        expect(screen.getByTestId('module-checkout-shipping-method')).toBeInTheDocument();
        expect(screen.getByTestId('shipping-empty')).toBeInTheDocument();
    });
});
