/**
 * all-pages-module-composed (Blog batch) — register the `/blog` index
 * and `/blog/[slug]` post system pages on the `SystemPageRegistry`.
 *
 *   1. blog-index  `/blog`        — locked `BlogFeed` section (limit 50).
 *   2. blog-post   `/blog/[slug]` — locked `BlogPost` section; the smart
 *      wrapper reads `[slug]` and fetches via `PostApi.getBySlug`.
 *
 * Unlike the `/account/*` system pages these are `indexable: true` —
 * blog is an SEO surface. The page files keep their full SEO `<Head>`
 * (JSON-LD, canonical, og/twitter) + Logo + footer chrome; only the
 * post-list / post-body JSX is replaced by `SystemPageDispatch`.
 *
 * Registered as a module-load side-effect — `PostsServiceLoader`
 * imports this file; the Pages feature's `bootstrapAll()` upserts the
 * Navigation rows at boot.
 */
import guid from '@utils/guid';
import {systemPageRegistry} from '@services/features/Pages/SystemPageRegistry';
import {EItemType} from '@enums/EItemType';
import type {ISection} from '@interfaces/ISection';

function lockedSection(moduleType: EItemType, lockReason: string, content = ''): ISection {
    return {
        id: guid(),
        type: 1,
        content: [{type: moduleType, content}],
        locked: true,
        lockReason,
    };
}

systemPageRegistry.register({
    systemKey: 'blog-index',
    slug: '/blog',
    titleI18nKey: 'blog.index.title',
    accessGate: 'open',
    seo: {indexable: true},
    defaultSections: () => [
        lockedSection(EItemType.BlogFeed, 'section.locked.blog-index', JSON.stringify({limit: 50, tag: '', heading: ''})),
    ],
});

systemPageRegistry.register({
    systemKey: 'blog-post',
    slug: '/blog/[slug]',
    titleI18nKey: 'blog.post.title',
    accessGate: 'open',
    seo: {indexable: true},
    defaultSections: () => [
        lockedSection(EItemType.BlogPost, 'section.locked.blog-post'),
    ],
});
