// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CheckoutPaymentForm from './CheckoutPaymentForm';
import {EItemType} from '@enums/EItemType';

describe('CheckoutPaymentForm', () => {
    it('renders card fields', () => {
        render(<CheckoutPaymentForm item={{type: EItemType.CheckoutPaymentForm, content: ''}} />);
        expect(screen.getByTestId('payment-card-number')).toBeInTheDocument();
    });
});
