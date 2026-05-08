import {McpTool} from '../types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {defineTool, runBatch} from './_shared';
import {scanPostStats} from '@services/features/Posts/PostStatsService';

const sessionFor = (actor: string) => ({kind: 'admin' as const, role: 'admin' as const, email: actor});

export const postList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'post.list',
    description: 'Lists blog posts. includeDrafts=true (default) returns drafts too. Useful before post.upsert to check for slug conflicts. Set `includeStats:true` to also annotate each post with `wordCount`, `imageCount`, and `tagCount`.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            includeDrafts: {type: 'boolean', default: true},
            limit: {type: 'integer', minimum: 1, maximum: 500, default: 100},
            includeStats: {type: 'boolean', description: 'When true, runs the body through the post-stats scanner and adds `wordCount`, `imageCount`, `tagCount` to each row.'},
        },
    },
}, async (args) => {
    try {
        const raw = await getMongoConnection().getPosts({
            includeDrafts: args.includeDrafts ?? true,
            limit: args.limit ?? 100,
        });
        const posts = JSON.parse(raw);
        if (!args.includeStats || !Array.isArray(posts)) return posts;
        const stats = scanPostStats(posts.map((p: any) => ({
            slug: p.slug, body: p.body, coverImage: p.coverImage, tags: p.tags,
        })));
        const bySlug = new Map(stats.map(s => [s.slug, s]));
        return posts.map((p: any) => {
            const s = bySlug.get(p.slug);
            return {
                ...p,
                wordCount: s?.wordCount ?? 0,
                imageCount: s?.imageCount ?? 0,
                tagCount: s?.tagCount ?? 0,
            };
        });
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const postGet: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'post.get',
    description: 'Returns a single blog post by slug, including its full body HTML.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        required: ['slug'],
        properties: {
            slug: {type: 'string', minLength: 1},
            includeDrafts: {type: 'boolean', default: true},
        },
    },
}, async (args) => {
    try {
        const raw = await getMongoConnection().getPost({slug: args.slug, includeDrafts: args.includeDrafts ?? true});
        return raw ? JSON.parse(raw) : {found: false, slug: args.slug};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

async function postUpsertOnce(ctx: any, payload: any): Promise<any> {
    const raw = await getMongoConnection().savePost({
        post: {
            id:         payload.id,
            slug:       payload.slug,
            title:      payload.title,
            excerpt:    payload.excerpt,
            body:       payload.body,
            tags:       payload.tags,
            coverImage: payload.coverImage,
            draft:      payload.draft ?? false,
        },
        expectedVersion: payload.expectedVersion ?? null,
        _session: sessionFor(ctx.actor),
    });
    return JSON.parse(raw);
}

const postItemProps = {
    id:          {type: 'string' as const},
    slug:        {type: 'string' as const},
    title:       {type: 'string' as const},
    excerpt:     {type: 'string' as const},
    body:        {type: 'string' as const},
    tags:        {type: 'array' as const, items: {type: 'string' as const}},
    coverImage:  {type: 'string' as const},
    draft:       {type: 'boolean' as const},
    expectedVersion: {type: 'integer' as const},
};

export const postUpsert: McpTool = defineTool({
    name: 'post.upsert',
    description: 'Create or update one or many blog posts. Single form: pass {slug, title, body, ...}. Bulk form: pass {items: IPost[]}. Bulk returns per-item failures via `data.failed[]` so a partial-batch failure doesn\'t abort the rest. Omit `id` to create. `body` is HTML. Reference: image.delete { ids[] }.',
    scopes: ['write:content'],
    idempotent: true,
    gqlMutation: 'savePost',
    inputSchema: {
        type: 'object',
        properties: {
            ...postItemProps,
            items: {
                type: 'array',
                items: {type: 'object', properties: postItemProps},
                description: 'Bulk variant. Each item is an IPost. Up to 500 items. Mutually exclusive with single-item args.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    const isBulk = Array.isArray(args.items);
    const items: Array<{id: string; payload: any}> = isBulk
        ? args.items.map((it: any, i: number) => ({id: String(it?.id ?? it?.slug ?? `idx:${i}`), payload: it}))
        : (typeof args.slug === 'string' && typeof args.title === 'string' && typeof args.body === 'string'
            ? [{id: String(args.id ?? args.slug), payload: args}]
            : []);
    if (!items.length) {
        throw new Error('post.upsert requires (slug+title+body) or non-empty `items[]`');
    }
    const batch = await runBatch(items, async (_id, payload) => ({
        result: await postUpsertOnce(ctx, payload),
    }));
    if (!isBulk) {
        const r = batch.results[0]!;
        return r.ok ? r.result : {ok: false, error: r.error};
    }
    return batch;
});

export const postDelete: McpTool = defineTool({
    name: 'post.delete',
    description: 'Permanently deletes a blog post by id. Irreversible — back up first.',
    scopes: ['write:content'],
    idempotent: true,
    gqlMutation: 'deletePost',
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    try {
        const raw = await getMongoConnection().deletePost({id: args.id, _session: sessionFor(ctx.actor)});
        return JSON.parse(raw);
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const POST_TOOLS: McpTool[] = [postList, postGet, postUpsert, postDelete];
