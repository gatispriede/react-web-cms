export interface IFooterEntry {
    label: string;
    url?: string;
}

export interface IFooterColumn {
    title: string;
    entries: IFooterEntry[];
}

export interface IFooterConfig {
    enabled: boolean;
    columns: IFooterColumn[];
    bottom?: string;
    /** Optimistic-concurrency counter — see `src/Server/conflict.ts`. */
    version?: number;
    editedBy?: string;
    editedAt?: string;
}

export const DEFAULT_FOOTER: IFooterConfig = {
    enabled: true,
    columns: [],
    bottom: `© ${new Date().getFullYear()}`,
};

/**
 * Build the rendered footer: admin-configured columns override the auto
 * section with the same title; otherwise auto + custom are concatenated.
 * Auto columns: "Site" (navigation pages), "Writing" (blog if any posts).
 */
export interface FooterAutoContext {
    pages: {page: string}[];
    hasPosts: boolean;
    blogEnabled?: boolean;
}

/**
 * Titles the auto "Site" column will also recognise as "operator
 * already has a nav-style column — don't add the default too". Matching
 * is case-insensitive and diacritic-tolerant via a normalise helper so
 * "Navigācija" and "navigacija" both suppress the duplicate.
 */
const NAV_TITLE_ALIASES = new Set([
    'site', 'nav', 'navigation', 'navigacija',
]);

const normaliseTitle = (s: string) =>
    (s || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function buildFooterColumns(
    config: IFooterConfig,
    ctx: FooterAutoContext,
    tr: (s: string) => string = (s) => s,
): IFooterColumn[] {
    const customTitlesNorm = new Set(
        config.columns.map(c => normaliseTitle(c.title)),
    );

    const auto: IFooterColumn[] = [];
    // Only emit the auto "Site" column if the operator hasn't already
    // configured one under any of the nav-ish aliases. Prevents the
    // "SITE + NAVIGĀCIJA" duplicate seen on sites where the operator
    // added their own localised nav column before we shipped the auto
    // column.
    const operatorHasNav = [...customTitlesNorm].some(t => NAV_TITLE_ALIASES.has(t));
    if (ctx.pages.length > 0 && !operatorHasNav) {
        auto.push({
            title: tr('Site'),
            entries: ctx.pages.map(p => ({
                label: p.page,
                url: '/' + encodeURIComponent(p.page.replace(/\s+/g, '-').toLowerCase()),
            })),
        });
    }
    if (ctx.hasPosts && ctx.blogEnabled !== false) {
        auto.push({title: tr('Writing'), entries: [{label: tr('Blog'), url: '/blog'}]});
    }
    const customByTitle = new Map(config.columns.map(c => [normaliseTitle(c.title), c]));
    const merged = auto.map(col =>
        customByTitle.has(normaliseTitle(col.title))
            ? customByTitle.get(normaliseTitle(col.title))!
            : col
    );
    for (const col of config.columns) {
        if (!auto.some(a => normaliseTitle(a.title) === normaliseTitle(col.title))) {
            merged.push(col);
        }
    }
    return merged;
}
