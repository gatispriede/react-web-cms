// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import TestimonialWall from './TestimonialWall';
import type {Testimonial} from './TestimonialWall.types';

const ITEMS: Testimonial[] = [
    {key: 'a', quote: 'It changed our workflow.', name: 'Ada Lovelace', role: 'CTO', company: 'Analytical'},
    {key: 'b', quote: 'Best tool we shipped this year.', name: 'Grace Hopper'},
];

describe('TestimonialWall', () => {
    it('renders null when items empty', () => {
        const {container} = render(<TestimonialWall testId="tw" items={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders one card per item', () => {
        render(<TestimonialWall testId="tw" items={ITEMS} />);
        expect(screen.getByTestId('tw-item-a')).toBeInTheDocument();
        expect(screen.getByTestId('tw-item-b')).toBeInTheDocument();
    });

    it('renders quote inside <blockquote>', () => {
        render(<TestimonialWall testId="tw" items={ITEMS} />);
        const q = screen.getByTestId('tw-quote-a');
        expect(q.tagName).toBe('BLOCKQUOTE');
        expect(q).toHaveTextContent('It changed our workflow.');
    });

    it('renders cite block with name + role + company', () => {
        render(<TestimonialWall testId="tw" items={ITEMS} />);
        const author = screen.getByTestId('tw-author-a');
        expect(author.querySelector('cite')?.textContent).toBe('Ada Lovelace');
        expect(author).toHaveTextContent('CTO, Analytical');
    });

    it('applies desktopColumns prop via class', () => {
        const {container} = render(<TestimonialWall testId="tw" items={ITEMS} desktopColumns={4} />);
        expect(container.firstChild).toHaveClass('testimonial-wall--cols-4');
    });
});
