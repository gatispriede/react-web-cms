// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import Pagination from './Pagination';

describe('Pagination', () => {
    it('renders load-more button + fires callback', () => {
        const onLoadMore = vi.fn();
        render(<Pagination content={{variant: 'load-more'}} onLoadMore={onLoadMore} hasMore />);
        const btn = screen.getByTestId('pagination-load-more');
        fireEvent.click(btn);
        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('hides itself when hasMore=false', () => {
        const {container} = render(<Pagination content={{variant: 'load-more'}} hasMore={false} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders sentinel for infinite-scroll', () => {
        render(<Pagination content={{variant: 'infinite-scroll'}} hasMore />);
        expect(screen.getByTestId('pagination-sentinel')).toBeInTheDocument();
    });
});
