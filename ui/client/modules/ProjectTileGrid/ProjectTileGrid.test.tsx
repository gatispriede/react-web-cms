// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import ProjectTileGrid from './ProjectTileGrid';
import type {ProjectTile} from './ProjectTileGrid.types';

const tiles: ProjectTile[] = [
    {key: 'a', title: 'Alpha', imageUrl: 'a.jpg', href: '/a', caption: 'First'},
    {key: 'b', title: 'Beta', imageUrl: 'b.jpg', href: '/b', tags: ['ux', 'web']},
];

describe('ProjectTileGrid', () => {
    it('returns null when empty', () => {
        const {container} = render(<ProjectTileGrid testId="ptg" tiles={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders one tile per item', () => {
        render(<ProjectTileGrid testId="ptg" tiles={tiles} />);
        expect(screen.getByTestId('ptg-tile-a')).toBeInTheDocument();
        expect(screen.getByTestId('ptg-tile-b')).toBeInTheDocument();
    });

    it('wraps each tile in an anchor with the href', () => {
        render(<ProjectTileGrid testId="ptg" tiles={tiles} />);
        expect(screen.getByTestId('ptg-link-a')).toHaveAttribute('href', '/a');
        expect(screen.getByTestId('ptg-link-b')).toHaveAttribute('href', '/b');
    });

    it('applies columns class', () => {
        render(<ProjectTileGrid testId="ptg" tiles={tiles} columns={4} />);
        expect(screen.getByTestId('ptg').className).toContain('project-tile-grid--cols-4');
    });

    it('defaults to columns=3', () => {
        render(<ProjectTileGrid testId="ptg" tiles={tiles} />);
        expect(screen.getByTestId('ptg').className).toContain('project-tile-grid--cols-3');
    });

    it('renders tags with indexed testids', () => {
        render(<ProjectTileGrid testId="ptg" tiles={tiles} />);
        expect(screen.getByTestId('ptg-tag-b-0')).toHaveTextContent('ux');
        expect(screen.getByTestId('ptg-tag-b-1')).toHaveTextContent('web');
        expect(screen.queryByTestId('ptg-tag-a-0')).toBeNull();
    });
});
