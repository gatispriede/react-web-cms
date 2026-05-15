// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import IntegrationGrid from './IntegrationGrid';
import type {Integration} from './IntegrationGrid.types';

const ITEMS: Integration[] = [
    {key: 'slk', name: 'Slack', status: 'live', href: 'https://slack.example', category: 'chat'},
    {key: 'lin', name: 'Linear', status: 'beta', category: 'issues'},
    {key: 'fig', name: 'Figma', status: 'soon'},
];

describe('IntegrationGrid', () => {
    it('renders null when items empty', () => {
        const {container} = render(<IntegrationGrid testId="ig" items={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders one tile per item', () => {
        render(<IntegrationGrid testId="ig" items={ITEMS} />);
        expect(screen.getByTestId('ig-tile-slk')).toBeInTheDocument();
        expect(screen.getByTestId('ig-tile-lin')).toBeInTheDocument();
        expect(screen.getByTestId('ig-tile-fig')).toBeInTheDocument();
    });

    it('exposes status via data-status attribute', () => {
        render(<IntegrationGrid testId="ig" items={ITEMS} />);
        expect(screen.getByTestId('ig-status-slk').getAttribute('data-status')).toBe('live');
        expect(screen.getByTestId('ig-status-lin').getAttribute('data-status')).toBe('beta');
        expect(screen.getByTestId('ig-status-fig').getAttribute('data-status')).toBe('soon');
    });

    it('wraps tile in <a> when href supplied', () => {
        render(<IntegrationGrid testId="ig" items={ITEMS} />);
        const tile = screen.getByTestId('ig-tile-slk');
        expect(tile.tagName).toBe('A');
        expect(tile.getAttribute('href')).toBe('https://slack.example');
        expect(screen.getByTestId('ig-tile-lin').tagName).toBe('DIV');
    });

    it('toggles category chip data-active and filters', () => {
        render(<IntegrationGrid testId="ig" items={ITEMS} categories={['chat', 'issues']} />);
        const chip = screen.getByTestId('ig-category-chat');
        expect(chip.getAttribute('data-active')).toBe('false');
        fireEvent.click(chip);
        expect(chip.getAttribute('data-active')).toBe('true');
        expect(screen.getByTestId('ig-tile-slk')).toBeInTheDocument();
        expect(screen.queryByTestId('ig-tile-lin')).toBeNull();
    });
});
