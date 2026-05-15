export interface WishlistItem {
    productId: string;
    title: string;
    /** Formatted (e.g. 'EUR 24,500'). */
    priceFormatted: string;
    thumbUrl: string;
    href: string;
    /** When true, primary action label is 'Reserve' (cars vertical); else 'Move to cart'. */
    isReservation?: boolean;
}

export interface WishlistEmptyState {
    title: string;
    description?: string;
    primary?: {label: string; href?: string; onClick?: () => void};
}

export interface WishlistGridProps {
    testId: string;
    items: WishlistItem[];
    /** Callback to remove a product from the wishlist. */
    onRemove: (productId: string) => void | Promise<void>;
    /** Callback for the primary action. */
    onPrimaryAction: (item: WishlistItem) => void | Promise<void>;
    /** When items is empty, render this empty-state spec. */
    emptyState?: WishlistEmptyState;
    /** Fixed columns count (1-4). Default is responsive (1 / 2 / 3 / 4). */
    columns?: 1 | 2 | 3 | 4;
}
