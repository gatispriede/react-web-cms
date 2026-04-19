export interface ISiteSeoDefaults {
    /** Human-readable site name, shown in browser tab and used for og:site_name. */
    siteName?: string;
    /** Fallback description used when a page has no `seo.description`. */
    defaultDescription?: string;
    /** Fallback comma-joined keywords; used when page has no keywords. */
    defaultKeywords?: string;
    /** Default og:image URL — local `api/<file>` or absolute `https://…`. */
    defaultImage?: string;
    /** Primary domain, e.g. `https://example.com` — used to build absolute URLs. */
    primaryDomain?: string;
    /** Twitter handle, e.g. `@example`. */
    twitterHandle?: string;
    /** Default author, used when page has no `seo.author`. */
    defaultAuthor?: string;
    /** Default locale for og:locale if not overridden. */
    defaultLocale?: string;
    editedBy?: string;
    editedAt?: string;
}

export const DEFAULT_SITE_SEO: ISiteSeoDefaults = {};
