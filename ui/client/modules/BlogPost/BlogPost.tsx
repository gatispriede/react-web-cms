import React, {useMemo} from 'react';
import type {BlogPostProps} from './BlogPost.types';

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    try {
        return d.toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'});
    } catch {
        return d.toISOString().slice(0, 10);
    }
}

const BlogPost: React.FC<BlogPostProps> = ({testId, title, coverUrl, coverAlt, bodyHtml, meta}) => {
    const showCover = !!coverUrl && !!coverAlt;
    const dateLabel = useMemo(() => formatDate(meta.publishedAt), [meta.publishedAt]);
    const tags = meta.tags ?? [];

    const authorContent = meta.author ? (
        <span className="blog-post__author-inner">
            {meta.author.avatarUrl ? (
                <img
                    className="blog-post__author-avatar"
                    src={meta.author.avatarUrl}
                    alt=""
                    aria-hidden
                />
            ) : null}
            <span className="blog-post__author-name">{meta.author.name}</span>
        </span>
    ) : null;

    return (
        <article className="blog-post" data-testid={testId}>
            {showCover ? (
                <img
                    className="blog-post__cover"
                    src={coverUrl}
                    alt={coverAlt}
                    data-testid={`${testId}-cover`}
                />
            ) : null}
            <h1 className="blog-post__title" data-testid={`${testId}-title`}>{title}</h1>
            <div className="blog-post__meta">
                {meta.author ? (
                    meta.author.href ? (
                        <a
                            className="blog-post__author"
                            href={meta.author.href}
                            data-testid={`${testId}-author`}
                        >{authorContent}</a>
                    ) : (
                        <span
                            className="blog-post__author"
                            data-testid={`${testId}-author`}
                        >{authorContent}</span>
                    )
                ) : null}
                <time
                    className="blog-post__date"
                    dateTime={meta.publishedAt}
                    data-testid={`${testId}-date`}
                >{dateLabel}</time>
                {meta.readingTime ? (
                    <span
                        className="blog-post__reading-time"
                        data-testid={`${testId}-reading-time`}
                    >{meta.readingTime}</span>
                ) : null}
            </div>
            <div
                className="blog-post__body"
                data-testid={`${testId}-body`}
                dangerouslySetInnerHTML={{__html: bodyHtml}}
            />
            {tags.length > 0 ? (
                <div className="blog-post__tags" data-testid={`${testId}-tags`}>
                    {tags.map(tag => tag.href ? (
                        <a
                            key={tag.key}
                            className="blog-post__tag"
                            href={tag.href}
                            data-testid={`${testId}-tag-${tag.key}`}
                        >{tag.label}</a>
                    ) : (
                        <span
                            key={tag.key}
                            className="blog-post__tag"
                            data-testid={`${testId}-tag-${tag.key}`}
                        >{tag.label}</span>
                    ))}
                </div>
            ) : null}
        </article>
    );
};

export default BlogPost;
export {BlogPost};
