/**
 * all-pages-module-composed — Blog batch smart wrapper.
 *
 * `BlogPostHost` bridges the pure presentational `BlogPost` module to
 * the `{item}` SystemPageDispatch contract: it reads the `[slug]` route
 * param, fetches the post via `PostApi.getBySlug`, sanitises the stored
 * body HTML (the pure module renders `bodyHtml` verbatim via
 * `dangerouslySetInnerHTML` — sanitisation is the host's job), and maps
 * `IPost` onto `BlogPostProps`.
 *
 * `/blog` (the index) reuses the already-registered `BlogFeed` module —
 * no wrapper needed there.
 */
import React, {useEffect, useState} from 'react';
import {useRouter} from 'next/router';
import {sanitizeHtml} from '@utils/sanitize';
import type {IItem} from '@interfaces/IItem';
import type {IPost} from '@interfaces/IPost';
import PostApi from '@services/api/client/PostApi';
import BlogPost from '@client/modules/BlogPost/BlogPost';

const postApi = new PostApi();

/** Force a leading slash on relative cover paths so they don't resolve
 *  against `/blog/<slug>`; absolute + protocol-relative pass through. */
function normalizeCover(raw: string | undefined): string | undefined {
    if (!raw) return undefined;
    return /^([a-z]+:|\/\/|\/)/i.test(raw) ? raw : `/${raw}`;
}

export const BlogPostHost: React.FC<{item: IItem}> = () => {
    const router = useRouter();
    const slug = typeof router.query.slug === 'string' ? router.query.slug : null;
    const [post, setPost] = useState<IPost | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // `router.query.slug` is empty during SSR / first hydration tick.
        if (!slug) return;
        let live = true;
        postApi.getBySlug(slug)
            .then(p => { if (live) setPost(p); })
            .catch(() => { if (live) setPost(null); })
            .finally(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [slug]);

    if (loading) return <p data-testid="blog-post-loading">Loading…</p>;
    if (!post) return <p data-testid="blog-post-missing">Post not found.</p>;

    const coverUrl = normalizeCover(post.coverImage);

    return (
        <BlogPost
            testId="blog-post"
            title={post.title}
            coverUrl={coverUrl}
            coverAlt={coverUrl ? post.title : undefined}
            bodyHtml={sanitizeHtml(post.body)}
            meta={{
                author: post.author ? {name: post.author} : undefined,
                publishedAt: post.publishedAt ?? post.createdAt,
                tags: (post.tags ?? []).map(tag => ({
                    key: tag,
                    label: tag,
                    href: `/blog?tag=${encodeURIComponent(tag)}`,
                })),
            }}
        />
    );
};
