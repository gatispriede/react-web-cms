/**
 * Image MCP tools — list / upload / delete / rescan.
 *
 * Upload accepts a base64 payload + filename and writes to
 * `ui/client/public/images/<sanitised-filename>`. The same sanitiser
 * the bundle import uses (kebab-stripped, no path separators) is
 * applied so an LLM can't escape the public images dir. After
 * write we route through `assetService.saveImage` so the Mongo
 * `Images` row is created with the same `tags=['All']` invariant
 * the form path enforces.
 */
import fs from 'fs';
import path from 'node:path';
import guid from '@utils/guid';
import {McpTool} from '../types';
import {enforceModeForTool} from '../modeEnforcement';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {PUBLIC_IMAGE_PATH} from '@utils/imgPath';
import {defineTool} from './_shared';

const IMAGES_DIR = path.join(process.cwd(), 'ui/client/public/images');
const NAME_RE = /[^a-zA-Z0-9._-]+/g;
const ALLOWED_EXT = /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i;

function sanitiseFilename(name: string): string {
    const base = path.basename(name).replace(/\s+/g, '_').replace(NAME_RE, '');
    if (!ALLOWED_EXT.test(base)) {
        throw new Error(`unsupported image extension: ${base}`);
    }
    return base;
}

export const imageList: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'image.list',
    description: 'Lists uploaded images. Returns name, URL (use as-is in content fields), tags, and dimensions. Always call this before setting any image field — never guess paths.',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            tags: {type: 'string', description: 'Filter by tag keyword. Omit or pass "" to list all.'},
        },
    },
}, async (args) => {
    try {
        const images = await getMongoConnection().getImages({tags: args.tags ?? ''});
        return images;
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const imageUpload: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct service write
    name: 'image.upload',
    description: 'Upload an image from a base64 payload. Filename is sanitised; only standard image extensions allowed. Returns the public location.',
    scopes: ['write:content'],
    idempotent: true,
    rateLimit: {maxPerMinute: 20},
    inputSchema: {
        type: 'object',
        required: ['filename', 'contentBase64'],
        properties: {
            filename: {type: 'string', minLength: 1},
            contentBase64: {type: 'string', minLength: 1},
            contentType: {type: 'string'},
            tags: {type: 'array', items: {type: 'string'}},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'image.upload');
    const filename = sanitiseFilename(String(args.filename));
    const dest = path.join(IMAGES_DIR, filename);
    if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, {recursive: true});
    if (fs.existsSync(dest)) {
        return {ok: false, error: 'image already exists', filename};
    }
    const buf = Buffer.from(String(args.contentBase64), 'base64');
    fs.writeFileSync(dest, buf);
    const tags = Array.isArray(args.tags) ? args.tags.filter(Boolean) as string[] : [];
    const withAll = tags.includes('All') ? tags : ['All', ...tags];
    const ext = path.extname(filename).slice(1).toLowerCase();
    const conn: any = getMongoConnection();
    await conn.assetService.saveImage({
        id: guid(),
        name: filename,
        location: `${PUBLIC_IMAGE_PATH}${filename}`,
        created: new Date().toDateString(),
        type: typeof args.contentType === 'string' ? args.contentType : `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        size: buf.length,
        tags: withAll,
    } as any);
    return {ok: true, filename, location: `${PUBLIC_IMAGE_PATH}${filename}`, size: buf.length};
});

export const imageDelete: McpTool = defineTool({
    name: 'image.delete',
    description: 'Delete an image (by id) — removes file from public/images and the Mongo Images row.',
    scopes: ['write:content'],
    idempotent: true,
    inputSchema: {
        type: 'object',
        required: ['id'],
        properties: {
            id: {type: 'string', minLength: 1},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'image.delete');
    const conn: any = getMongoConnection();
    // Look up the row so we know the on-disk filename.
    const all = await conn.getImages({tags: ''});
    const row = (all ?? []).find((r: any) => r.id === args.id);
    const res = await conn.assetService.deleteImage(args.id);
    let fileDeleted = false;
    if (row?.name) {
        const target = path.join(IMAGES_DIR, sanitiseFilename(String(row.name)));
        try {
            if (fs.existsSync(target)) { fs.unlinkSync(target); fileDeleted = true; }
        } catch { /* swallow — row deleted is the contract */ }
    }
    return {ok: true, deleted: typeof res === 'string' ? res : 1, fileDeleted, name: row?.name ?? null};
});

export const imageRescan: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct asset service call
    name: 'image.rescan',
    description: 'Walk public/images and create Mongo rows for any file missing one. Returns {added, skipped, total}.',
    scopes: ['write:content'],
    idempotent: true,
    rateLimit: {maxPerMinute: 5},
    inputSchema: {
        type: 'object',
        properties: {
            idempotencyKey: {type: 'string'},
        },
    },
}, async (_args, ctx) => {
    await enforceModeForTool(ctx.actor, 'image.rescan');
    const conn: any = getMongoConnection();
    return await conn.assetService.rescanDiskImages(ctx.actor);
});

export const IMAGE_TOOLS: McpTool[] = [imageList, imageUpload, imageDelete, imageRescan];
