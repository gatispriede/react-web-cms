export interface BlogPostMeta {
    author?: {name: string; avatarUrl?: string; href?: string};
    /** ISO publish date. */
    publishedAt: string;
    /** Optional reading-time string ('5 min read'). */
    readingTime?: string;
    tags?: Array<{key: string; label: string; href?: string}>;
}

export interface BlogPostProps {
    testId: string;
    title: string;
    coverUrl?: string;
    coverAlt?: string;
    /** Operator-authored sanitised HTML. */
    bodyHtml: string;
    meta: BlogPostMeta;
}
