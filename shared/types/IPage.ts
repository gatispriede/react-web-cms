import {ISeo} from "./ISeo";

export interface IPage {
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
    sections: string[]
}
