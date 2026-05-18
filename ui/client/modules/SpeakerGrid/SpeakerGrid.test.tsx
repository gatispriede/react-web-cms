// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import SpeakerGrid from './SpeakerGrid';
import type {Speaker} from './SpeakerGrid.types';

const speakers: Speaker[] = [
    {
        key: 'a',
        name: 'Alice',
        role: 'CTO',
        bio: 'Bio of Alice',
        socials: [
            {platform: 'twitter', url: 'https://twitter.com/a'},
            {platform: 'linkedin', url: 'https://linkedin.com/in/a'},
        ],
    },
    {key: 'b', name: 'Bob', bio: 'Bio of Bob'},
];

describe('SpeakerGrid', () => {
    it('renders one card per speaker', () => {
        render(<SpeakerGrid testId="sg" speakers={speakers} />);
        expect(screen.getByTestId('sg-card-a')).toBeInTheDocument();
        expect(screen.getByTestId('sg-card-b')).toBeInTheDocument();
        expect(screen.queryByTestId('sg-modal')).toBeNull();
    });

    it('click opens dialog', () => {
        render(<SpeakerGrid testId="sg" speakers={speakers} />);
        fireEvent.click(screen.getByTestId('sg-card-a'));
        expect(screen.getByTestId('sg-modal')).toBeInTheDocument();
    });

    it('close button closes the modal', () => {
        render(<SpeakerGrid testId="sg" speakers={speakers} />);
        fireEvent.click(screen.getByTestId('sg-card-a'));
        fireEvent.click(screen.getByTestId('sg-modal-close'));
        expect(screen.queryByTestId('sg-modal')).toBeNull();
    });

    it('escape closes the modal', () => {
        render(<SpeakerGrid testId="sg" speakers={speakers} />);
        fireEvent.click(screen.getByTestId('sg-card-a'));
        fireEvent.keyDown(window, {key: 'Escape'});
        expect(screen.queryByTestId('sg-modal')).toBeNull();
    });

    it('initialOpenKey opens dialog on mount', () => {
        render(<SpeakerGrid testId="sg" speakers={speakers} initialOpenKey="b" />);
        expect(screen.getByTestId('sg-modal')).toBeInTheDocument();
    });

    it('social links have correct hrefs', () => {
        render(<SpeakerGrid testId="sg" speakers={speakers} initialOpenKey="a" />);
        const twitter = screen.getByTestId('sg-social-a-twitter');
        expect(twitter.getAttribute('href')).toBe('https://twitter.com/a');
        expect(twitter.getAttribute('rel')).toBe('noopener noreferrer');
    });

    it('renders nothing when speakers empty', () => {
        const {container} = render(<SpeakerGrid testId="sg" speakers={[]} />);
        expect(container.firstChild).toBeNull();
    });
});
