// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import PlaceOrderButton from './PlaceOrderButton';
import {EItemType} from '@enums/EItemType';

describe('PlaceOrderButton', () => {
    it('renders default label', () => {
        render(<PlaceOrderButton item={{type: EItemType.PlaceOrderButton, content: ''}} />);
        expect(screen.getByTestId('module-place-order-button')).toHaveTextContent('Place order');
    });
});
