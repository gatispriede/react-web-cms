import {McpTool} from '../types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

const ok = (data: unknown) => ({content: [{type: 'text' as const, text: JSON.stringify(data)}]});
const sessionFor = (actor: string) => ({kind: 'admin' as const, role: 'admin' as const, email: actor});

export const postList: McpTool = {
    name: 'post.list',
    description: 'Lists blog posts. includeDrafts=true (default) returns drafts too. Useful before post.upsert to check for slug conflicts.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            includeDrafts: {type: 'boolean', default: true},
            limit: {type: 'integer', minimum: 1, maximum: 500, default: 100},
        },
    },
    handler: async (args) => {
        try {
            const raw = await getMongoConnection().getPosts({
                includeDrafts: args.includeDrafts ?? true,
                limit: args.limit ?? 100,
            });
            return ok(JSON.parse(raw));
        } catch (err) {
            return ok({ok: false, error: String((err as Error).message || err)});
        }
    },
};

export const postGet: McpTool = {
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
    handler: async (args) => {
        try {
            const raw = await getMongoConnection().getPost({slug: args.slug, includeDrafts: args.includeDrafts ?? true});
            return ok(raw ? JSON.parse(raw) : {found: false, slug: args.slug});
        } catch (err) {
            return ok({ok: false, error: String((err as Error).message || err)});
        }
    },
};

export const postUpsert: McpTool = {
    name: 'post.upsert',
    description: 'Create or update a blog post. Omit `id` to create. `body` is HTML — use semantic tags (<h2>, <p>, <ul>, <strong>). `draft: false` publishes immediately.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['slug', 'title', 'body'],
        properties: {
            id:          {type: 'string',  description: 'Existing post id for update (omit to create)'},
            slug:        {type: 'string',  description: 'URL-safe slug e.g. "my-post-title"'},
            title:       {type: 'string'},
            excerpt:     {type: 'string',  description: '1–2 sentence summary shown in feeds'},
            body:        {type: 'string',  description: 'HTML body content'},
            tags:        {type: 'array', items: {type: 'string'}},
            coverImage:  {type: 'string',  description: 'Image path e.g. "api/photo.jpg"'},
            draft:       {type: 'boolean', default: false},
            expectedVersion: {type: 'integer', description: 'Optimistic-concurrency guard — include if updating'},
        },
    },
    handler: async (args, ctx) => {
        try {
            const raw = await getMongoConnection().savePost({
                post: {
                    id:         args.id,
                    slug:       args.slug,
                    title:      args.title,
                    excerpt:    args.excerpt,
                    body:       args.body,
                    tags:       args.tags,
                    coverImage: args.coverImage,
                    draft:      args.draft ?? false,
                },
                expectedVersion: args.expectedVersion ?? null,
                _session: sessionFor(ctx.actor),
            });
            return ok(JSON.parse(raw));
        } catch (err) {
            return ok({ok: false, error: String((err as Error).message || err)});
        }
    },
};

export const postDelete: McpTool = {
    name: 'post.delete',
    description: 'Permanently deletes a blog post by id. Irreversible — back up first.',
    scopes: ['write:content'],
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
        },
    },
    handler: async (args, ctx) => {
        try {
            const raw = await getMongoConnection().deletePost({id: args.id, _session: sessionFor(ctx.actor)});
            return ok(JSON.parse(raw));
        } catch (err) {
            return ok({ok: false, error: String((err as Error).message || err)});
        }
    },
};

export const POST_TOOLS: McpTool[] = [postList, postGet, postUpsert, postDelete];
