// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CartActions from './CartActions';
import {EItemType} from '@enums/EItemType';

describe('CartActions', () => {
    it('renders proceed + clear buttons', () => {
        render(<CartActions item={{type: EItemType.CartActions, content: ''}} />);
        expect(screen.getByTestId('cart-actions-clear')).toBeInTheDocument();
        expect(screen.getByTestId('cart-actions-proceed')).toBeInTheDocument();
    });
});
