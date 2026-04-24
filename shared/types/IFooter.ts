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

export function buildFooterColumns(
    config: IFooterConfig,
    ctx: FooterAutoContext,
    tr: (s: string) => string = (s) => s,
): IFooterColumn[] {
    const auto: IFooterColumn[] = [];
    if (ctx.pages.length > 0) {
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
    const customByTitle = new Map(config.columns.map(c => [c.title.toLowerCase(), c]));
    const merged = auto.map(col =>
        customByTitle.has(col.title.toLowerCase())
            ? customByTitle.get(col.title.toLowerCase())!
            : col
    );
    for (const col of config.columns) {
        if (!auto.some(a => a.title.toLowerCase() === col.title.toLowerCase())) {
            merged.push(col);
        }
    }
    return merged;
}
