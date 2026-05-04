/**
 * bundle.export / bundle.import — whole-site replace.
 *
 * Both tools work with a local file path rather than inline JSON because
 * full-site bundles routinely exceed 50 MB (base64-embedded assets).
 * Passing that through JSON-RPC would blow every token / buffer limit.
 *
 * Scope gate: `admin:bundle` — issue these tokens sparingly.
 * bundle.import is also blocked in simplified-mode (see ADVANCED_TOOLS.ts).
 */
import * as fs   from 'node:fs/promises';
import * as path from 'node:path';
import {McpTool} from '../types';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {enforceModeForTool} from '../modeEnforcement';
import type {SiteBundle} from '@services/features/Bundle/BundleService';
import {defineTool} from './_shared';

export const bundleExport: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'bundle.export',
    description: 'Exports the full site (pages, sections, themes, images, posts, i18n) to a JSON file at `path`. The file can be imported into any CMS instance with bundle.import.',
    scopes: ['admin:bundle'],
    rateLimit: {maxPerMinute: 5},
    inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
            path: {
                type: 'string',
                description: 'Absolute or repo-relative path to write the bundle JSON, e.g. "/tmp/site-export.json"',
            },
        },
    },
}, async (args) => {
    try {
        const bundle = await getMongoConnection().bundleService.export();
        const dest = path.resolve(args.path as string);
        await fs.writeFile(dest, JSON.stringify(bundle), 'utf8');
        const stat = await fs.stat(dest);
        return {
            exported: true,
            path: dest,
            sizeBytes: stat.size,
            sectionCount: bundle.site?.sections?.length ?? 0,
            assetCount: Object.keys(bundle.assets ?? {}).length,
            exportedAt: bundle.manifest?.exportedAt,
        };
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const bundleImport: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'bundle.import',
    description: 'Replaces ALL site content from a bundle JSON file at `path`. This is a full overwrite — pages, sections, themes, images, posts, i18n are all replaced. Irreversible without a prior bundle.export backup.',
    scopes: ['admin:bundle'],
    idempotent: true,
    rateLimit: {maxPerMinute: 5},
    inputSchema: {
        type: 'object',
        required: ['path'],
        properties: {
            path: {
                type: 'string',
                description: 'Absolute or repo-relative path to the bundle JSON to import.',
            },
            idempotencyKey: {type: 'string'},
        },
    },
}, async (args, ctx) => {
    await enforceModeForTool(ctx.actor, 'bundle.import');
    try {
        const src = path.resolve(args.path as string);
        const raw = await fs.readFile(src, 'utf8');
        const bundle = JSON.parse(raw) as SiteBundle;
        const result = await getMongoConnection().bundleService.import(bundle);
        return {imported: true, ...result};
    } catch (err) {
        return {ok: false, error: String((err as Error).message || err)};
    }
});

export const BUNDLE_TOOLS: McpTool[] = [bundleExport, bundleImport];
