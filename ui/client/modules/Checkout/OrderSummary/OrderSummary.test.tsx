// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import OrderSummary from './OrderSummary';
import {EItemType} from '@enums/EItemType';

describe('OrderSummary', () => {
    it('renders', () => {
        render(<OrderSummary item={{type: EItemType.OrderSummary, content: ''}} />);
        expect(screen.getByTestId('module-order-summary')).toBeInTheDocument();
    });
});
