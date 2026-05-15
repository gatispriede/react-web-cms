// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import AccountWelcome from './AccountWelcome';
import {EItemType} from '@enums/EItemType';

describe('AccountWelcome', () => {
    it('renders', () => {
        render(<AccountWelcome item={{type: EItemType.AccountWelcome, content: ''}} />);
        expect(screen.getByTestId('module-account-welcome')).toBeInTheDocument();
    });
});
