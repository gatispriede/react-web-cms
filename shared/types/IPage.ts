import {ISeo} from "./ISeo";

export interface IPage {
    /**
     * Stable id from `INavigation.id`. Optional because legacy callers
     * that build an `IPage` from a display-name list don't have one.
     * F7 — threaded through the public shell so the menu builder can
     * key parent ↔ child relationships off the canonical id (instead
     * of accidentally using the display name as both key and label).
     */
    id?: string,
    page: string,
    /**
     * Parent page reference (`INavigation.id`). `undefined` = root page.
     * F1 sub-pages — children inherit URL prefix from the parent's slug
     * chain; references are id-based so renaming a parent does not
     * break child URLs.
     */
    parent?: string,
    /**
     * Explicit URL slug. Separate from `page` (display name) so a
     * rename does not change the URL silently. Optional in the type
     * because legacy rows pre-date the field — the service backfills
     * `slugifyAnchor(page)` on next save.
     *
     * Per-locale shape (F1 sub-pages follow-up): a bare string is the
     * legacy single-locale form; a `Record<localeCode, string>` carries
     * one slug per active locale. Resolution falls back to the default
     * locale's entry, then to `slugifyAnchor(page)`.
     */
    slug?: string | Record<string, string>,
    seo: ISeo,
    sections: string[],
    /**
     * Phase 0b discriminator: which "kind" of page this row is.
     *   - `'manual'` — legacy operator-authored page (default when unset).
     *   - `'product'` — warehouse-derived leaf product page from the
     *     products-as-composable-page item; the renderer resolves the
     *     bound `productId` and applies the chosen `IProductTemplate`.
     *   - `'system-page'` — framework-required page seeded by
     *     `SystemPageRegistry` (cart, checkout-*, order-confirmation,
     *     account-settings, magic-link-verify, …). Operators can still
     *     edit sections; the bootstrap loop preserves their edits.
     *
     * Unset (or any unknown value) is treated as `'manual'` so legacy rows
     * keep working without a backfill migration.
     */
    source?: 'manual' | 'product' | 'system-page',
    /**
     * When `source === 'system-page'`, the well-known key identifying which
     * system page this is. Used by
     * `SystemPageRegistry.ensureSystemPage(systemKey)` to look up the
     * canonical defaults + locked sections list.
     *
     * Examples: `'cart'`, `'checkout-address'`, `'checkout-shipping'`,
     * `'checkout-payment'`, `'checkout-confirmation'`, `'account-settings'`,
     * `'order-by-token'`, `'magic-link-verify'`.
     */
    systemKey?: string,
    /**
     * When `source === 'product'`, the productId this page renders. Used by
     * the leaf-product page renderer in products-as-composable-page to
     * resolve the product + apply `IProductTemplate` (when set) for
     * product-display-templates.
     */
    productId?: string,
}
