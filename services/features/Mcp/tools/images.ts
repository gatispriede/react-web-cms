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
import {loadUsageSources, scanImageUsage, UsageConnection} from '@services/features/Assets/ImageUsageService';
import {optimizeImageBuffer, type RatioLock} from '@services/features/Assets/imageOptimize';
import {buildImageRecord} from '@services/infra/imageMetadata';

const IMAGES_DIR = path.join(process.cwd(), 'ui/client/public/images');
const NAME_RE = /[^a-zA-Z0-9._-]+/g;
const ALLOWED_EXT = /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i;

// Mirror the ratio set the admin bulk-upload modal + `/api/upload-batch`
// accept. `free` (or omitted) keeps the upload uncropped; any other value
// triggers the same sharp cover-crop the admin surface uses, so MCP — the
// canonical AI write path — has parity with the human bulk-upload flow.
const RATIO_LOCKS: RatioLock[] = ['free', '1:1', '4:3', '3:2', '16:9'];
const normaliseRatio = (raw: unknown): RatioLock =>
    (typeof raw === 'string' && (RATIO_LOCKS as string[]).includes(raw)) ? raw as RatioLock : 'free';

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
    description: 'Lists uploaded images. Returns name, URL (use as-is in content fields), tags, and dimensions. Always call this before setting any image field — never guess paths. Set `includeUsage:true` to also get `usageCount` + `usedIn` for each image (powers the "show unused" filter).',
    scopes: ['read:content'],
    inputSchema: {
        type: 'object',
        properties: {
            tags: {type: 'string', description: 'Filter by tag keyword. Omit or pass "" to list all.'},
            includeUsage: {type: 'boolean', description: 'When true, scans pages, sections, posts, logo, footer, site SEO and themes; each returned image gets `usageCount` (number of references) and `usedIn` (compact location list).'},
            unusedOnly: {type: 'boolean', description: 'When true (and `includeUsage` is also true), filters the response to images with `usageCount === 0`. No-op without `includeUsage`.'},
        },
    },
}, async (args) => {
    try {
        const conn: UsageConnection = getMongoConnection() as unknown as UsageConnection;
        const images = await conn.getImages({tags: args.tags ?? ''});
        if (!args.includeUsage) return images;
        const sources = await loadUsageSources(conn);
        // Override the inventory with the (possibly tag-filtered) `images`
        // result so usageCount/usedIn line up with what we're returning.
        const usage = scanImageUsage({...sources, images});
        const annotated = images.map(img => {
            const entry = usage.get(img.name);
            return {
                ...img,
                usageCount: entry?.count ?? 0,
                usedIn: entry?.refs ?? [],
            };
        });
        return args.unusedOnly
            ? annotated.filter(r => r.usageCount === 0)
            : annotated;
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const imageUpload: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct service write
    name: 'image.upload',
    description: 'Upload an image from a base64 payload. Filename is sanitised; only standard image extensions allowed. The bytes run through the same optimise pipeline as the admin upload form — resize to a 1920px long edge, recompress, strip EXIF — and the persisted record carries width/height/sizeBytes/format. Pass `ratio` (one of free/1:1/4:3/3:2/16:9) to cover-crop the image to that aspect ratio on ingest, matching the admin bulk-upload modal. Corrupt payloads are rejected. Returns the public location + optimised size.',
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
            ratio: {type: 'string', enum: ['free', '1:1', '4:3', '3:2', '16:9'], description: 'Aspect-ratio lock — cover-crops the image to this ratio on ingest. Omit or pass "free" to keep the original framing.'},
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
    const ratio = normaliseRatio(args.ratio);
    // Run the shared optimise pipeline before writing — MCP is the canonical
    // write path, so an LLM-uploaded image gets the same resize/recompress/
    // EXIF-strip treatment as one dropped through the admin form. When a
    // `ratio` is passed the same sharp cover-crop the bulk-upload modal uses
    // runs here too — MCP/admin parity for the aspect-ratio control. Corrupt
    // bytes (`readable: false`) are rejected; SVG/GIF pass through untouched.
    const opt = await optimizeImageBuffer(buf, ratio !== 'free' ? {ratio} : {});
    if (!opt.readable) {
        return {ok: false, error: 'unrecognised or corrupt image file', filename};
    }
    fs.writeFileSync(dest, opt.buffer);
    const tags = Array.isArray(args.tags) ? args.tags.filter(Boolean) as string[] : [];
    const withAll = tags.includes('All') ? tags : ['All', ...tags];
    const ext = path.extname(filename).slice(1).toLowerCase();
    const conn: any = getMongoConnection();
    // Same persisted record shape as the upload endpoints — width/height/
    // sizeBytes/originalName/uploadedBy/uploadedAt/optimised/format ride
    // through to Mongo (write-through; GraphQL SDL exposure is a separate
    // read-side migration).
    const record = buildImageRecord(opt, {
        id: guid(),
        storedName: filename,
        location: `${PUBLIC_IMAGE_PATH}${filename}`,
        type: typeof args.contentType === 'string' ? args.contentType : `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        tags: withAll,
        originalName: String(args.filename),
        uploadedBy: ctx.actor,
        fallbackSize: buf.length,
    });
    await conn.assetService.saveImage(record as any);
    return {
        ok: true,
        filename,
        location: `${PUBLIC_IMAGE_PATH}${filename}`,
        size: opt.size,
        width: opt.width,
        height: opt.height,
        optimised: opt.optimised,
        ratio,
    };
});

async function deleteOneImage(
    id: string,
    inventory: Array<{id: string; name?: string}>,
    conn: {assetService: {deleteImage: (id: string) => Promise<unknown>}},
): Promise<{id: string; ok: boolean; name: string | null; fileDeleted: boolean; error?: string}> {
    try {
        const row = inventory.find(r => r.id === id);
        const res = await conn.assetService.deleteImage(id);
        let fileDeleted = false;
        if (row?.name) {
            const target = path.join(IMAGES_DIR, sanitiseFilename(String(row.name)));
            try {
                if (fs.existsSync(target)) { fs.unlinkSync(target); fileDeleted = true; }
            } catch { /* swallow — Mongo row deletion is the contract */ }
        }
        return {id, ok: true, name: row?.name ?? null, fileDeleted, deleted: typeof res === 'string' ? res : 1} as never;
    } catch (err) {
        return {id, ok: false, name: null, fileDeleted: false, error: String((err as Error).message || err)};
    }
}

export const imageDelete: McpTool = defineTool({
    name: 'image.delete',
    description: 'Delete one or many images by id — removes the file from public/images and the Mongo Images row. Accepts either `id` (single) or `ids` (array, up to 500). Bulk form returns per-id results so partial failures don\'t abort the batch.',
    scopes: ['write:content'],
    idempotent: true,
    // Schema enforces shape; the handler enforces "exactly one of id/ids
    // non-empty" since the local JSONSchemaObject type doesn't surface
    // `oneOf`. Both fields are optional at the schema layer.
    inputSchema: {
        type: 'object',
        properties: {
            id: {type: 'string', minLength: 1, description: 'Single image id. Mutually exclusive with `ids`.'},
            ids: {type: 'array', items: {type: 'string', minLength: 1}, description: 'Bulk image ids (up to 500). Mutually exclusive with `id`.'},
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'image.delete');
    const conn: any = getMongoConnection();
    const ids: string[] = Array.isArray(args.ids)
        ? args.ids.filter((s: unknown): s is string => typeof s === 'string' && s.length > 0)
        : (typeof args.id === 'string' ? [args.id] : []);
    if (!ids.length) {
        throw new Error('image.delete requires `id` or non-empty `ids[]`');
    }
    // One inventory fetch reused across the batch — avoids hammering
    // Mongo with `getImages` per id when deleting hundreds at once.
    const inventory = (await conn.getImages({tags: ''})) ?? [];
    const results = [] as Awaited<ReturnType<typeof deleteOneImage>>[];
    for (const id of ids) {
        results.push(await deleteOneImage(id, inventory, conn));
    }
    // Backward-compat: when called with single `id`, return the original
    // flat shape so existing callers don't break.
    if (typeof args.id === 'string' && !Array.isArray(args.ids)) {
        const r = results[0]!;
        return r.ok
            ? {ok: true, deleted: 1, fileDeleted: r.fileDeleted, name: r.name}
            : {ok: false, error: r.error};
    }
    const deleted = results.filter(r => r.ok).map(r => r.id);
    const failed = results.filter(r => !r.ok).map(r => ({id: r.id, error: r.error}));
    return {
        ok: failed.length === 0,
        deletedCount: deleted.length,
        failedCount: failed.length,
        deleted,
        failed,
        results,
    };
});

export const imageRescan: McpTool = defineTool({
    // SAFE: not a GraphQL mutation — direct asset service call
    name: 'image.rescan',
    description: 'Walk public/images and create Mongo rows for any file missing one. Returns {added, skipped, total}. Emits MCP `notifications/progress` per file when the client passes a `progressToken` in `_meta`.',
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
    return await conn.assetService.rescanDiskImages(
        ctx.actor,
        ctx.notify
            ? async (p: {progress: number; total: number; message: string}) => { await ctx.notify!(p); }
            : undefined,
    );
});

export const IMAGE_TOOLS: McpTool[] = [imageList, imageUpload, imageDelete, imageRescan];
