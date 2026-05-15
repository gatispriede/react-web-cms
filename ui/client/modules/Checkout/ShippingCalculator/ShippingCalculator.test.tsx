// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ShippingCalculator from './ShippingCalculator';
import {EItemType} from '@enums/EItemType';

describe('ShippingCalculator', () => {
    it('renders', () => {
        render(<ShippingCalculator item={{type: EItemType.ShippingCalculator, content: ''}} />);
        expect(screen.getByTestId('shipping-calculator-postal')).toBeInTheDocument();
    });
});
