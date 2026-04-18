import React, {useEffect, useState} from "react";
import {Card, Empty, Space, Spin, Tag} from "antd";
import Link from "next/link";
import {TFunction} from "i18next";
import {EItemType} from "../../../enums/EItemType";
import {IItem} from "../../../Interfaces/IItem";
import ContentManager from "../ContentManager";
import PostApi from "../../api/PostApi";
import {IPost} from "../../../Interfaces/IPost";
import RevealOnScroll from "../common/RevealOnScroll";
import {usePrefetchedPosts} from "../../lib/PostsContext";

export interface IBlogFeed {
    limit: number;
    tag: string;
    heading: string;
}

export enum EBlogFeedStyle {
    Default = "default",
    Compact = "compact",
}

const defaults: IBlogFeed = {limit: 6, tag: '', heading: ''};

export class BlogFeedContent extends ContentManager {
    public _parsedContent: IBlogFeed = {...defaults};
    get data(): IBlogFeed { this.parse(); return {...defaults, ...this._parsedContent}; }
    set data(v: IBlogFeed) { this._parsedContent = v; }
    setField<K extends keyof IBlogFeed>(k: K, v: IBlogFeed[K]) { this._parsedContent[k] = v; }
}

const postApi = new PostApi();

const BlogFeed = ({item}: {
    item: IItem;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
}) => {
    const c = new BlogFeedContent(EItemType.BlogFeed, item.content).data;
    const prefetched = usePrefetchedPosts();
    const filterPrefetched = (list: IPost[]) => (c.tag ? list.filter(p => p.tags.includes(c.tag)) : list).slice(0, c.limit);
    const [posts, setPosts] = useState<IPost[] | null>(prefetched ? filterPrefetched(prefetched) : null);

    useEffect(() => {
        if (prefetched) return;
        let cancelled = false;
        (async () => {
            const list = await postApi.list({limit: c.limit});
            if (cancelled) return;
            setPosts(filterPrefetched(list));
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [c.limit, c.tag, prefetched]);

    if (!posts) return <Spin/>;
    if (posts.length === 0) return <Empty description={'No posts yet.'}/>;

    return (
        <div>
            {c.heading && <h3 style={{marginTop: 0}}>{c.heading}</h3>}
            <div className="blog-feed">
                {posts.map((p, i) => (
                    <RevealOnScroll key={p.id} delay={i * 60}>
                        <Link href={`/blog/${p.slug}`} style={{textDecoration: 'none'}}>
                            <Card
                                className="blog-card"
                                hoverable
                                cover={p.coverImage ? <img src={p.coverImage} alt={p.title} style={{height: 160, objectFit: 'cover'}}/> : undefined}
                            >
                                <Card.Meta
                                    title={p.title}
                                    description={
                                        <Space direction="vertical" size={4} style={{width: '100%'}}>
                                            <span style={{fontSize: '.85em', opacity: .65}}>
                                                {p.publishedAt ? p.publishedAt.slice(0, 10) : ''}
                                            </span>
                                            {p.excerpt && <span>{p.excerpt}</span>}
                                            {p.tags.length > 0 && (
                                                <Space size={4} wrap>
                                                    {p.tags.slice(0, 3).map(t => <Tag key={t}>{t}</Tag>)}
                                                </Space>
                                            )}
                                        </Space>
                                    }
                                />
                            </Card>
                        </Link>
                    </RevealOnScroll>
                ))}
            </div>
        </div>
    );
};

export default BlogFeed;
