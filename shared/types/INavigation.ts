import {ISeo} from "./ISeo";

export interface INavigation {
    id: string
    type: string;
    page: string,
    /**
     * Parent navigation `id`. `undefined` = root page. See F1 sub-pages
     * design — id-based so parent rename does not break references.
     */
    parent?: string,
    /**
     * Explicit URL slug. Optional for legacy rows; backfilled by
     * `NavigationService.addUpdateNavigationItem` to `slugifyAnchor(page)`
     * on next save.
     *
     * Per-locale shape: bare string = legacy single-locale form; a
     * `Record<localeCode, string>` carries a slug per active locale.
     * Resolution: `slug[locale] ?? slug[defaultLocale] ?? slugifyAnchor(page)`.
     */
    slug?: string | Record<string, string>,
    seo: ISeo | undefined,
    sections: string[]
}
