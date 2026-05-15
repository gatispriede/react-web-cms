// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import SocialShareButtons from './SocialShareButtons';
import {EItemType} from '@enums/EItemType';

describe('SocialShareButtons', () => {
    it('renders 3 share buttons', () => {
        render(<SocialShareButtons item={{type: EItemType.SocialShareButtons, content: ''}} />);
        expect(screen.getByTestId('social-share-twitter')).toBeInTheDocument();
        expect(screen.getByTestId('social-share-facebook')).toBeInTheDocument();
        expect(screen.getByTestId('social-share-linkedin')).toBeInTheDocument();
    });
});
