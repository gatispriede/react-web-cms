/**
 * Resolve a product's primary image, with a category-keyed placeholder
 * fallback when the product carries none.
 *
 * Category mapping is keyword-based (substring match against the
 * product's `categories[]` array, case-insensitive). The first match
 * wins; falls through to a generic placeholder. New categories slot in
 * cheaply — add a row to `CATEGORY_TO_PLACEHOLDER`.
 *
 * Used by storefront (`/products`, `/products/[slug]`) and the admin
 * Products table for a consistent visual fallback. Warehouse-sourced
 * products with real CDN URLs render those untouched.
 */

const PLACEHOLDER_DIR = '/images/product-placeholders';

/** Substring → placeholder slug. First hit wins. */
const CATEGORY_TO_PLACEHOLDER: ReadonlyArray<{match: string; slug: string}> = [
    {match: 'cpu', slug: 'cpu'},
    {match: 'processor', slug: 'cpu'},
    {match: 'gpu', slug: 'gpu'},
    {match: 'graphics', slug: 'gpu'},
    {match: 'video-card', slug: 'gpu'},
    {match: 'ram', slug: 'ram'},
    {match: 'memory', slug: 'ram'},
    {match: 'ddr', slug: 'ram'},
    {match: 'ssd', slug: 'ssd'},
    {match: 'nvme', slug: 'ssd'},
    {match: 'storage', slug: 'ssd'},
    {match: 'motherboard', slug: 'motherboard'},
    {match: 'mainboard', slug: 'motherboard'},
    {match: 'am5', slug: 'motherboard'},
    {match: 'psu', slug: 'psu'},
    {match: 'power', slug: 'psu'},
    {match: 'atx30', slug: 'psu'},
];

/** Resolve a placeholder slug from a category list (case-insensitive substring). */
export function placeholderForCategories(categories: readonly string[] | undefined): string {
    if (!categories?.length) return `${PLACEHOLDER_DIR}/default.svg`;
    const lowered = categories.map(c => (c || '').toLowerCase());
    for (const {match, slug} of CATEGORY_TO_PLACEHOLDER) {
        if (lowered.some(c => c.includes(match))) return `${PLACEHOLDER_DIR}/${slug}.svg`;
    }
    return `${PLACEHOLDER_DIR}/default.svg`;
}

/**
 * Returns the URL to use as a product's primary image. Real first image
 * (when present), otherwise a category-keyed placeholder.
 */
export function productPrimaryImage(product: {images?: readonly string[]; categories?: readonly string[]}): string {
    const first = product.images?.find(s => typeof s === 'string' && s.trim().length > 0);
    if (first) return first;
    return placeholderForCategories(product.categories);
}
