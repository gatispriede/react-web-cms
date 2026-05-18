// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import TrustBadges from './TrustBadges';
import {EItemType} from '@enums/EItemType';

describe('TrustBadges', () => {
    it('renders default badges', () => {
        render(<TrustBadges item={{type: EItemType.TrustBadges, content: ''}} />);
        expect(screen.getByTestId('module-trust-badges')).toBeInTheDocument();
        expect(screen.getByTestId('trust-badge-0')).toBeInTheDocument();
    });
});
