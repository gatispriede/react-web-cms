// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CheckoutAddressForm from './CheckoutAddressForm';
import {EItemType} from '@enums/EItemType';

describe('CheckoutAddressForm', () => {
    it('renders fields', () => {
        render(<CheckoutAddressForm item={{type: EItemType.CheckoutAddressForm, content: ''}} />);
        expect(screen.getByTestId('address-form-name')).toBeInTheDocument();
        expect(screen.getByTestId('address-form-submit')).toBeInTheDocument();
    });
});
