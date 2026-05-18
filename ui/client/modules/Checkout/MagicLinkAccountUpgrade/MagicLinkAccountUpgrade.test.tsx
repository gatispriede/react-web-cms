// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import MagicLinkAccountUpgrade from './MagicLinkAccountUpgrade';
import {EItemType} from '@enums/EItemType';

describe('MagicLinkAccountUpgrade', () => {
    it('renders', () => {
        render(<MagicLinkAccountUpgrade item={{type: EItemType.MagicLinkAccountUpgrade, content: ''}} />);
        expect(screen.getByTestId('magic-link-upgrade-cta')).toBeInTheDocument();
    });
});
