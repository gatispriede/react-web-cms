/**
 * Phase 1.C — Pagination types.
 * Cursor-based; load-more button OR infinite-scroll variant
 * (predefined Select — only these two values are valid).
 */
export type PaginationVariant = 'load-more' | 'infinite-scroll';

export interface IPagination {
    /** Constrained selection — predefined values only (per coding-principles). */
    variant: PaginationVariant;
    /** Items per cursor page. Default 24. */
    pageSize?: number;
    /** Optional cursor seeded from SSR. */
    initialCursor?: string;
}

export enum EPaginationStyle {
    Default = 'default',
    Slim = 'slim',
}

export const PAGINATION_VARIANT_OPTIONS: ReadonlyArray<{value: PaginationVariant; label: string}> = [
    {value: 'load-more', label: 'Load-more button'},
    {value: 'infinite-scroll', label: 'Infinite scroll'},
];
