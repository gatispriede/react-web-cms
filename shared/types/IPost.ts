export interface IPost {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    coverImage?: string;
    tags: string[];
    author?: string;
    publishedAt?: string;
    draft: boolean;
    body: string;
    createdAt: string;
    updatedAt: string;
    /** Optimistic-concurrency counter — see `src/Server/conflict.ts`. */
    version?: number;
    editedBy?: string;
    editedAt?: string;
    /**
     * F2 — optional pin to a Navigation row. Carries the Navigation `id`
     * (NOT slug, NOT page name) so renames on the parent page don't break
     * the link. `undefined` means the post is unpinned and conceptually
     * lives at the `/blog` root.
     *
     * Pinning is purely a CASCADE anchor today: when the pinned page is
     * deleted, the post cascades to trash with it, restored together. The
     * public URL stays `/blog/${slug}` regardless of pin — pin does NOT
     * mount the post under the page's path. If a "pinned blog" surface
     * (e.g. `/services/cleaning/blog/post-name`) ships later, the routing
     * is a follow-up; the data model is forward-compatible.
     */
    pageId?: string;
}

export interface InPost {
    id?: string;
    slug: string;
    title: string;
    excerpt?: string;
    coverImage?: string;
    tags?: string[];
    author?: string;
    publishedAt?: string;
    draft?: boolean;
    body: string;
    /** F2 — Navigation row id this post is pinned to. See `IPost.pageId`. */
    pageId?: string;
}
