/**
 * CMS tool implementations for the inline agent.
 *
 * Uses the service layer directly (same process) rather than the GraphQL API.
 * This avoids auth overhead and gives the agent access to draft/admin-only data.
 *
 * Tools mirror the external cms-tools.js schema so system prompts are identical.
 */

import fs   from 'fs';
import path from 'path';
import type MongoDBConnection    from '@services/infra/mongoDBConnection';
import type {ToolDefinition, ToolDispatch} from './agentTypes';

// ── Backup storage (temp file so it survives hot-reloads) ─────────────────────
const BACKUP_PATH = path.join(process.cwd(), '.agent-backup.json');

// ── Tool definitions ─────────────────────────────────────────────────────────

export const CMS_TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        name: 'list_posts',
        description: 'List all blog posts (id, slug, title, draft status)',
        input_schema: {
            type: 'object',
            properties: {
                includeDrafts: { type: 'boolean', description: 'Include draft posts (default false)' },
            },
        },
    },
    {
        name: 'save_post',
        description: 'Create or update a blog post',
        input_schema: {
            type: 'object',
            properties: {
                id:          { type: 'string',  description: 'Existing post id for update (omit to create)' },
                slug:        { type: 'string',  description: 'URL slug e.g. "my-post"' },
                title:       { type: 'string',  description: 'Post title' },
                excerpt:     { type: 'string',  description: 'Short description' },
                body:        { type: 'string',  description: 'HTML body content' },
                tags:        { type: 'array',   items: { type: 'string' }, description: 'Tag list' },
                draft:       { type: 'boolean', description: 'true = draft, false = published' },
                coverImage:  { type: 'string',  description: 'Cover image path e.g. /api/image.jpg' },
            },
            required: ['slug', 'title', 'body'],
        },
    },
    {
        name: 'list_pages',
        description: 'List CMS pages (id, page name, type)',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'list_sections',
        description: 'Read the existing sections (and their content) for a CMS page. Call this before add_section so you know what is already on the page.',
        input_schema: {
            type: 'object',
            properties: {
                pageName: { type: 'string', description: 'Page name to inspect e.g. "Main"' },
            },
            required: ['pageName'],
        },
    },
    {
        name: 'create_page',
        description: 'Create a new CMS page entry',
        input_schema: {
            type: 'object',
            properties: {
                page:     { type: 'string', description: 'Page name / URL path e.g. "about"' },
                type:     { type: 'string', description: 'Page type e.g. "page"' },
                sections: { type: 'array',  items: { type: 'string' }, description: 'Initial section ids (usually empty)' },
            },
            required: ['page'],
        },
    },
    {
        name: 'add_section',
        description: 'Add or update a section on a CMS page',
        input_schema: {
            type: 'object',
            properties: {
                pageName: { type: 'string', description: 'Page this section belongs to' },
                type:     { type: 'number', description: 'Column count: 1 | 2 | 3 | 4' },
                content: {
                    type: 'array',
                    description: 'Items array — one entry per column',
                    items: {
                        type: 'object',
                        properties: {
                            type:    { type: 'string', description: 'Module type e.g. HERO, RICH_TEXT, STATS_CARD' },
                            content: { type: 'string', description: 'JSON-encoded module content' },
                            style:   { type: 'string', description: 'Style variant' },
                        },
                        required: ['type', 'content'],
                    },
                },
            },
            required: ['pageName', 'type', 'content'],
        },
    },
    {
        name: 'publish_site',
        description: 'Publish a snapshot of the site (makes all edits live)',
        input_schema: {
            type: 'object',
            properties: {
                note: { type: 'string', description: 'Optional publish note' },
            },
        },
    },
    {
        name: 'list_images',
        description: 'List all uploaded images available on the site. Returns name, URL (location), and tags for each image. Use this before setting any image field — always pick a real image URL from this list or leave image as empty string "".',
        input_schema: {
            type: 'object',
            properties: {
                tags: { type: 'string', description: 'Filter by tag keyword (e.g. "hero", "portfolio"). Use "All" or omit to list everything.' },
            },
        },
    },
    {
        name: 'create_backup',
        description: 'Save a full backup of all site content right now. Call this automatically at the start of any session that will make changes. The backup can be restored with restore_backup if something goes wrong.',
        input_schema: {
            type: 'object',
            properties: {
                note: { type: 'string', description: 'Optional description of what you are about to do' },
            },
        },
    },
    {
        name: 'restore_backup',
        description: 'Restore the site to the last backup created by create_backup. Use this if something went wrong and needs to be undone.',
        input_schema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'set_layout_mode',
        description: 'Switch the site between scroll mode (all pages on one long page) and per-page mode (each page has its own URL). Call publish_site after to make the change live.',
        input_schema: {
            type: 'object',
            properties: {
                mode: { type: 'string', enum: ['tabs', 'scroll'], description: '"tabs" = each page is its own URL (per-page mode). "scroll" = all pages stack on one scrolling page.' },
            },
            required: ['mode'],
        },
    },
];

// ── Tool dispatcher ──────────────────────────────────────────────────────────

export function makeCmsDispatch(conn: MongoDBConnection, editedBy: string): ToolDispatch {
    return async (name, input) => {
        switch (name) {
            case 'list_posts': {
                const posts = await conn.postService.list({ includeDrafts: true });
                return JSON.stringify(posts.map(p => ({
                    id:    p.id,
                    slug:  p.slug,
                    title: p.title,
                    draft: p.draft,
                })));
            }

            case 'save_post': {
                const { id, slug, title, excerpt = '', body, tags = [], draft = false, coverImage } = input as any;
                const result = await conn.postService.save(
                    { id, slug, title, excerpt, body, tags, draft, coverImage },
                    editedBy,
                );
                return JSON.stringify(result);
            }

            case 'list_pages': {
                const pages = await conn.navigationService.getNavigationCollection();
                return JSON.stringify(pages.map(p => ({ id: p.id, page: p.page, type: p.type })));
            }

            case 'list_sections': {
                const { pageName } = input as any;
                const pages = await conn.navigationService.getNavigationCollection();
                const page = pages.find((p: any) => p.page === pageName);
                if (!page) return JSON.stringify({ error: `Page "${pageName}" not found` });
                const sectionIds: string[] = (page as any).sections ?? [];
                if (sectionIds.length === 0) return JSON.stringify([]);
                const sections = await conn.navigationService.getSections(sectionIds);
                return JSON.stringify(sections.map((s: any) => ({
                    id:      s.id,
                    type:    s.type,
                    page:    s.page,
                    content: (s.content ?? []).map((item: any) => ({
                        type:    item.type,
                        content: item.content,
                        style:   item.style,
                    })),
                })));
            }

            case 'create_page': {
                const { page, type = 'page', sections = [] } = input as any;
                await conn.navigationService.addUpdateNavigationItem(page, sections, editedBy);
                return JSON.stringify({ ok: true, page, type });
            }

            case 'add_section': {
                const { pageName, type, content } = input as any;
                // Ensure each item's content is a JSON string — models often send
                // an object even when instructed to stringify. Coerce here so the
                // renderer always receives a string it can JSON.parse.
                const normalizedContent = (Array.isArray(content) ? content : []).map((item: any) => ({
                    ...item,
                    content: typeof item.content === 'string'
                        ? item.content
                        : JSON.stringify(item.content ?? {}),
                }));
                const section = { type, content: normalizedContent, page: pageName };
                const raw = await conn.navigationService.addUpdateSectionItem({
                    section,
                    pageName,
                    editedBy,
                });
                // addUpdateSectionItem returns JSON like {"createSection":{"id":"...","version":1}}
                // or {"error":"..."} — unwrap to give the model a clean response.
                try {
                    const parsed = JSON.parse(raw);
                    const sectionId = parsed?.createSection?.id ?? parsed?.updateSection?.id;
                    if (parsed?.error) return JSON.stringify({ error: parsed.error, pageName });
                    return JSON.stringify({ ok: true, sectionId, pageName });
                } catch {
                    return JSON.stringify({ ok: true, pageName });
                }
            }

            case 'publish_site': {
                const { note } = input as any;
                const meta = await conn.publishService.publishSnapshot(editedBy, note);
                return JSON.stringify({ ok: true, id: meta.id, publishedAt: meta.publishedAt });
            }

            case 'list_images': {
                const { tags = 'All' } = input as any;
                const images = await conn.assetService.getImages(tags);
                return JSON.stringify(images.map((img: any) => ({
                    name:     img.name,
                    url:      img.location,   // e.g. "api/photo.jpg"
                    tags:     img.tags ?? [],
                })));
            }

            case 'create_backup': {
                const { note } = input as any;
                const bundle = await conn.bundleService.export();
                const payload = { createdAt: new Date().toISOString(), note: note ?? '', bundle };
                fs.writeFileSync(BACKUP_PATH, JSON.stringify(payload), 'utf8');
                return JSON.stringify({ ok: true, createdAt: payload.createdAt, note: payload.note });
            }

            case 'restore_backup': {
                if (!fs.existsSync(BACKUP_PATH)) {
                    return JSON.stringify({ error: 'No backup found. Run create_backup first.' });
                }
                const payload = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
                const result = await conn.bundleService.import(payload.bundle);
                return JSON.stringify({ ok: true, restoredFrom: payload.createdAt, collections: result.restored });
            }

            case 'set_layout_mode': {
                const { mode } = input as any;
                if (mode !== 'tabs' && mode !== 'scroll') {
                    return JSON.stringify({ error: 'mode must be "tabs" or "scroll"' });
                }
                await conn.siteFlagsService.save({ layoutMode: mode }, editedBy);
                return JSON.stringify({ ok: true, layoutMode: mode });
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    };
}
