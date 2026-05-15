/**
 * Pagination — Phase 1.C.
 *
 * Surface-level renderer; the actual cursor wiring sits in the page-level
 * query controller, which this module subscribes to via a callback prop.
 * The auto-injected template emits the `load-more` variant by default.
 */
import React from 'react';
import type {IItem} from '@interfaces/IItem';
import type {IPagination} from './Pagination.types';

export interface PaginationProps {
    item: IItem;
    onLoadMore?: () => void;
    hasMore?: boolean;
}

function parseContent(raw: string | IPagination | undefined): IPagination {
    if (!raw) return {variant: 'load-more'};
    if (typeof raw === 'string') {
        try { return JSON.parse(raw) as IPagination; } catch { return {variant: 'load-more'}; }
    }
    return raw;
}

const Pagination: React.FC<PaginationProps> = ({item, onLoadMore, hasMore = true}) => {
    const c = parseContent(item.content as string | IPagination | undefined);
    if (!hasMore) return null;
    if (c.variant === 'infinite-scroll') {
        // The IntersectionObserver wiring lives in the page-level
        // controller; the module just renders a sentinel marker. Keeps
        // SSR + hydration symmetric.
        return (
            <div className="pagination pagination--infinite" data-testid="pagination-sentinel" aria-hidden />
        );
    }
    return (
        <div className="pagination pagination--load-more" data-testid="pagination">
            <button
                type="button"
                onClick={onLoadMore}
                className="pagination__button"
                data-testid="pagination-load-more"
            >
                Load more
            </button>
        </div>
    );
};

export default Pagination;
export {Pagination};
