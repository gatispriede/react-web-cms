// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import MoneyBackGuarantee from './MoneyBackGuarantee';
import {EItemType} from '@enums/EItemType';

describe('MoneyBackGuarantee', () => {
    it('renders', () => {
        render(<MoneyBackGuarantee item={{type: EItemType.MoneyBackGuarantee, content: ''}} />);
        expect(screen.getByTestId('module-money-back-guarantee')).toBeInTheDocument();
    });
});
