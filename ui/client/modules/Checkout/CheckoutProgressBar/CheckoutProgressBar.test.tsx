// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CheckoutProgressBar from './CheckoutProgressBar';
import {EItemType} from '@enums/EItemType';

describe('CheckoutProgressBar', () => {
    it('renders 4 steps', () => {
        render(<CheckoutProgressBar item={{type: EItemType.CheckoutProgressBar, content: ''}} currentStep="shipping" />);
        expect(screen.getByTestId('module-checkout-progress-bar')).toBeInTheDocument();
        expect(screen.getByTestId('checkout-progress-step-payment')).toBeInTheDocument();
    });
});
