// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CartLineItems from './CartLineItems';
import {EItemType} from '@enums/EItemType';

describe('CartLineItems', () => {
    it('renders with empty content', () => {
        render(<CartLineItems item={{type: EItemType.CartLineItems, content: ''}} />);
        expect(screen.getByTestId('module-cart-line-items')).toBeInTheDocument();
    });
    it('renders operator-edited title', () => {
        render(<CartLineItems item={{type: EItemType.CartLineItems, content: JSON.stringify({title: 'Custom'})}} />);
        expect(screen.getByText('Custom')).toBeInTheDocument();
    });
});
