/**
 * PostStatsService — per-post wordCount / imageCount / tagCount. Powers
 * `post.list { includeStats }` and the admin "Posts" overview table.
 *
 * Why a service: the stat math is trivial in isolation but the HTML
 * stripping rules (drop tags, collapse whitespace, count `<img>` separately
 * from a bare coverImage) deserve one home so the MCP and UI never
 * disagree on a count.
 */

export interface PostStatsInput {
    slug: string;
    body?: string;
    coverImage?: string;
    tags?: string[];
}

export interface PostStats {
    slug: string;
    /** Visible-text word count after HTML stripping. */
    wordCount: number;
    /** `<img>` occurrences inside the body + 1 if `coverImage` is set. */
    imageCount: number;
    tagCount: number;
}

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const HTML_TAG_RE = /<[^>]+>/g;

function countImages(body: string | undefined, coverImage: string | undefined): number {
    let n = 0;
    if (typeof body === 'string') {
        const matches = body.match(IMG_TAG_RE);
        if (matches) n += matches.length;
    }
    if (typeof coverImage === 'string' && coverImage.trim().length > 0) n += 1;
    return n;
}

function countWords(body: string | undefined): number {
    if (typeof body !== 'string' || body.length === 0) return 0;
    // Strip tags first, then collapse whitespace and split. Decoding HTML
    // entities is intentionally skipped — the stat is a guidance number,
    // not a publication-grade word count, and decoding `&amp;` etc. would
    // require a full HTML parser for marginal gain.
    const text = body.replace(HTML_TAG_RE, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return 0;
    return text.split(' ').length;
}

export function scanPostStats(posts: readonly PostStatsInput[]): PostStats[] {
    return posts.map(p => ({
        slug: p.slug,
        wordCount: countWords(p.body),
        imageCount: countImages(p.body, p.coverImage),
        tagCount: Array.isArray(p.tags) ? p.tags.length : 0,
    }));
}

export interface PostStatsConnection {
    /**
     * `MongoDBConnection.getPosts` returns a JSON string; the FeatureLoader-side
     * `PostService.list` returns the parsed array. Either shape accepted.
     */
    getPosts(args?: {includeDrafts?: boolean; limit?: number}): Promise<string | Array<PostStatsInput>>;
}

export async function loadPostStatsSources(conn: PostStatsConnection): Promise<PostStatsInput[]> {
    const raw = await conn.getPosts({includeDrafts: true, limit: 1000});
    if (Array.isArray(raw)) {
        return raw.map(p => ({
            slug: p.slug,
            body: p.body,
            coverImage: p.coverImage,
            tags: p.tags,
        }));
    }
    if (typeof raw !== 'string' || raw.length === 0) return [];
    try {
        const parsed = JSON.parse(raw) as Array<PostStatsInput>;
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}
