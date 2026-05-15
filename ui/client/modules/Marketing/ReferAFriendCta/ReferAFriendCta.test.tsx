// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ReferAFriendCta from './ReferAFriendCta';
import {EItemType} from '@enums/EItemType';

describe('ReferAFriendCta', () => {
    it('renders', () => {
        render(<ReferAFriendCta item={{type: EItemType.ReferAFriendCta, content: ''}} />);
        expect(screen.getByTestId('module-refer-a-friend-cta')).toBeInTheDocument();
    });
});
