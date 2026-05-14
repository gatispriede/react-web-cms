// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import BlogPost from './BlogPost';

describe('BlogPost', () => {
    it('renders title + body', () => {
        render(
            <BlogPost
                testId="bp"
                title="Hello"
                bodyHtml="<p>Body content</p>"
                meta={{publishedAt: '2025-04-10T00:00:00Z'}}
            />,
        );
        expect(screen.getByTestId('bp-title')).toHaveTextContent('Hello');
        expect(screen.getByTestId('bp-body').innerHTML).toContain('<p>Body content</p>');
    });

    it('renders cover only when coverUrl + coverAlt provided', () => {
        const {rerender} = render(
            <BlogPost
                testId="bp"
                title="T"
                bodyHtml=""
                meta={{publishedAt: '2025-04-10T00:00:00Z'}}
            />,
        );
        expect(screen.queryByTestId('bp-cover')).not.toBeInTheDocument();
        rerender(
            <BlogPost
                testId="bp"
                title="T"
                coverUrl="/x.jpg"
                coverAlt="Cover"
                bodyHtml=""
                meta={{publishedAt: '2025-04-10T00:00:00Z'}}
            />,
        );
        expect(screen.getByTestId('bp-cover')).toHaveAttribute('src', '/x.jpg');
    });

    it('renders author block only when meta.author present', () => {
        const {rerender} = render(
            <BlogPost
                testId="bp"
                title="T"
                bodyHtml=""
                meta={{publishedAt: '2025-04-10T00:00:00Z'}}
            />,
        );
        expect(screen.queryByTestId('bp-author')).not.toBeInTheDocument();
        rerender(
            <BlogPost
                testId="bp"
                title="T"
                bodyHtml=""
                meta={{publishedAt: '2025-04-10T00:00:00Z', author: {name: 'Alice'}}}
            />,
        );
        expect(screen.getByTestId('bp-author')).toHaveTextContent('Alice');
    });

    it('renders date via locale', () => {
        render(
            <BlogPost
                testId="bp"
                title="T"
                bodyHtml=""
                meta={{publishedAt: '2025-04-10T00:00:00Z'}}
            />,
        );
        const date = screen.getByTestId('bp-date');
        expect(date).toBeInTheDocument();
        expect(date.textContent).toMatch(/2025|10|April|Apr/);
    });

    it('renders reading-time conditionally', () => {
        const {rerender} = render(
            <BlogPost
                testId="bp"
                title="T"
                bodyHtml=""
                meta={{publishedAt: '2025-04-10T00:00:00Z'}}
            />,
        );
        expect(screen.queryByTestId('bp-reading-time')).not.toBeInTheDocument();
        rerender(
            <BlogPost
                testId="bp"
                title="T"
                bodyHtml=""
                meta={{publishedAt: '2025-04-10T00:00:00Z', readingTime: '5 min read'}}
            />,
        );
        expect(screen.getByTestId('bp-reading-time')).toHaveTextContent('5 min read');
    });

    it('renders tag chips with correct testids', () => {
        render(
            <BlogPost
                testId="bp"
                title="T"
                bodyHtml=""
                meta={{
                    publishedAt: '2025-04-10T00:00:00Z',
                    tags: [{key: 'ev', label: 'EVs'}, {key: 'sedans', label: 'Sedans'}],
                }}
            />,
        );
        expect(screen.getByTestId('bp-tags')).toBeInTheDocument();
        expect(screen.getByTestId('bp-tag-ev')).toHaveTextContent('EVs');
        expect(screen.getByTestId('bp-tag-sedans')).toHaveTextContent('Sedans');
    });

    it('renders tag href when provided', () => {
        render(
            <BlogPost
                testId="bp"
                title="T"
                bodyHtml=""
                meta={{
                    publishedAt: '2025-04-10T00:00:00Z',
                    tags: [{key: 'ev', label: 'EVs', href: '/blog/tag/ev'}],
                }}
            />,
        );
        expect(screen.getByTestId('bp-tag-ev')).toHaveAttribute('href', '/blog/tag/ev');
    });
});
