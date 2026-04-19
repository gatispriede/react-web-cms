import fs from 'fs/promises';
import path from 'node:path';
import type {Collection, Db} from 'mongodb';
import {validateSectionInput} from '../utils/contentSchemas';

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), 'src/frontend/public/images');
const IMAGE_PATH_PREFIX = 'api/';
const BUNDLE_VERSION = 1;

export interface SiteBundle {
    manifest: {
        version: number;
        exportedAt: string;
        app: string;
    };
    site: {
        navigation: any[];
        sections: any[];
        languages: any[];
        logo: any | null;
        images: any[];
        themes?: any[];
        activeThemeId?: string | null;
        posts?: any[];
        /** Layout mode + blog toggle. Imported via SiteSettings key 'siteFlags'. */
        siteFlags?: {blogEnabled?: boolean; layoutMode?: 'tabs' | 'scroll'};
        /** Footer config. Imported via SiteSettings key 'footer'. */
        footer?: any;
        /** Site-wide SEO defaults. Imported via SiteSettings key 'siteSeo'. */
        siteSeo?: any;
    };
    /** filename -> data URI. Omitted entries are expected to be 3rd-party URLs still in `site`. */
    assets: Record<string, string>;
}

const MIME_BY_EXT: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
};

/** Extract local asset filenames from arbitrary JSON content. */
const collectLocalAssets = (node: unknown, out: Set<string>): void => {
    if (!node) return;
    if (typeof node === 'string') {
        if (node.startsWith(IMAGE_PATH_PREFIX) || node.startsWith('/' + IMAGE_PATH_PREFIX)) {
            out.add(node.replace(/^\//, '').slice(IMAGE_PATH_PREFIX.length));
        }
        return;
    }
    if (Array.isArray(node)) {
        for (const item of node) collectLocalAssets(item, out);
        return;
    }
    if (typeof node === 'object') {
        for (const v of Object.values(node as Record<string, unknown>)) collectLocalAssets(v, out);
    }
};

/** Recursively strip Mongo-internal _id fields from an object for round-trip cleanliness. */
const stripMongoIds = <T>(node: T): T => {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(stripMongoIds) as unknown as T;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === '_id') continue;
        out[k] = stripMongoIds(v);
    }
    return out as unknown as T;
};

export class BundleService {
    private db: Db;
    constructor(db: Db) {
        this.db = db;
    }

    private col(name: string): Collection {
        return this.db.collection(name);
    }

    async export(): Promise<SiteBundle> {
        const [navigation, sections, languages, images, logos, themes, activeSetting, posts, flagsSetting, footerSetting, siteSeoSetting] = await Promise.all([
            this.col('Navigation').find({}).toArray(),
            this.col('Sections').find({}).toArray(),
            this.col('Languages').find({}).toArray(),
            this.col('Images').find({}).toArray(),
            this.col('Logos').find({}).toArray(),
            this.col('Themes').find({}).toArray(),
            this.col('SiteSettings').findOne({key: 'activeThemeId'}),
            this.col('Posts').find({}).toArray(),
            this.col('SiteSettings').findOne({key: 'siteFlags'}),
            this.col('SiteSettings').findOne({key: 'footer'}),
            this.col('SiteSettings').findOne({key: 'siteSeo'}),
        ]);

        const site = stripMongoIds({
            navigation,
            sections,
            languages,
            images,
            logo: logos[0] ?? null,
            themes,
            activeThemeId: (activeSetting as any)?.value ?? null,
            posts,
            siteFlags: (flagsSetting as any)?.value ?? undefined,
            footer: (footerSetting as any)?.value ?? undefined,
            siteSeo: (siteSeoSetting as any)?.value ?? undefined,
        });

        const localAssets = new Set<string>();
        collectLocalAssets(site, localAssets);

        const assets: Record<string, string> = {};
        for (const name of Array.from(localAssets)) {
            try {
                const safeName = path.basename(name);
                const filePath = path.join(PUBLIC_IMAGES_DIR, safeName);
                const buf = await fs.readFile(filePath);
                const ext = path.extname(safeName).toLowerCase();
                const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream';
                assets[safeName] = `data:${mime};base64,${buf.toString('base64')}`;
            } catch (err) {
                console.warn(`[bundle] missing asset on disk, skipping: ${name}`);
            }
        }

        return {
            manifest: {
                version: BUNDLE_VERSION,
                exportedAt: new Date().toISOString(),
                app: 'redis-node-js-cloud',
            },
            site,
            assets,
        };
    }

    /**
     * Replace all site data with the bundle's contents. Destructive — caller is expected
     * to have confirmed. Writes assets to disk, then swaps collections in order.
     */
    async import(bundle: SiteBundle): Promise<{restored: Record<string, number>; assets: number; skippedAssets: string[]}> {
        if (!bundle?.manifest || bundle.manifest.version !== BUNDLE_VERSION) {
            throw new Error(`Unsupported bundle version: ${bundle?.manifest?.version}`);
        }
        if (!bundle.site || typeof bundle.site !== 'object') {
            throw new Error('Invalid bundle: missing site object');
        }
        // Required shape — each key either absent or an array (logo is singular/null).
        for (const k of ['navigation', 'sections', 'languages', 'images', 'themes', 'posts'] as const) {
            if (bundle.site[k] !== undefined && !Array.isArray(bundle.site[k])) {
                throw new Error(`Invalid bundle: site.${k} must be an array`);
            }
        }
        // Content schema validation — atomic; reject bundle if any section is malformed.
        if (Array.isArray(bundle.site.sections)) {
            for (let i = 0; i < bundle.site.sections.length; i++) {
                const result = validateSectionInput(bundle.site.sections[i]);
                if (!result.valid) {
                    throw new Error(`Invalid bundle: sections[${i}]: ${result.error}`);
                }
            }
        }

        await fs.mkdir(PUBLIC_IMAGES_DIR, {recursive: true});

        const SAFE_ASSET_NAME = /^[\w.\-]+\.(jpg|jpeg|png|gif|webp|svg)$/i;
        const MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25 MB per image
        const DATA_URI = /^data:image\/(jpeg|png|gif|webp|svg\+xml);base64,(.*)$/;

        let assetsWritten = 0;
        const skippedAssets: string[] = [];

        for (const [name, dataUri] of Object.entries(bundle.assets ?? {})) {
            const safeName = path.basename(name);
            if (!SAFE_ASSET_NAME.test(safeName)) {
                skippedAssets.push(`${name}: unsafe filename`);
                continue;
            }
            const match = DATA_URI.exec(dataUri);
            if (!match) {
                skippedAssets.push(`${name}: not a supported image data URI`);
                continue;
            }
            const buf = Buffer.from(match[2], 'base64');
            if (buf.length > MAX_ASSET_BYTES) {
                skippedAssets.push(`${name}: exceeds ${MAX_ASSET_BYTES} bytes`);
                continue;
            }
            const filePath = path.join(PUBLIC_IMAGES_DIR, safeName);
            // Extra belt-and-braces check: resolved path must stay inside PUBLIC_IMAGES_DIR.
            if (!path.resolve(filePath).startsWith(path.resolve(PUBLIC_IMAGES_DIR))) {
                skippedAssets.push(`${name}: path traversal blocked`);
                continue;
            }
            await fs.writeFile(filePath, buf);
            assetsWritten++;
        }

        const restored: Record<string, number> = {};
        const put = async (collectionName: string, docs: any[]) => {
            const col = this.col(collectionName);
            await col.deleteMany({});
            if (docs?.length) await col.insertMany(docs);
            restored[collectionName] = docs?.length ?? 0;
        };

        await put('Navigation', bundle.site.navigation ?? []);
        await put('Sections', bundle.site.sections ?? []);
        await put('Languages', bundle.site.languages ?? []);
        await put('Images', bundle.site.images ?? []);
        await put('Logos', bundle.site.logo ? [bundle.site.logo] : []);
        if (bundle.site.themes !== undefined) {
            await put('Themes', bundle.site.themes);
        }
        if (bundle.site.posts !== undefined) {
            await put('Posts', bundle.site.posts);
        }
        if (bundle.site.activeThemeId !== undefined) {
            const settings = this.col('SiteSettings');
            if (bundle.site.activeThemeId) {
                await settings.updateOne(
                    {key: 'activeThemeId'},
                    {$set: {key: 'activeThemeId', value: bundle.site.activeThemeId}},
                    {upsert: true},
                );
            } else {
                await settings.deleteOne({key: 'activeThemeId'});
            }
        }
        // Extended settings — siteFlags, footer, siteSeo travel with the bundle
        // so a "theme+content" import flips layoutMode + footer + SEO defaults
        // atomically (same as activeThemeId above). Each one is opt-in: an
        // importer without these keys leaves the existing settings alone.
        const putSetting = async (key: string, value: any) => {
            const settings = this.col('SiteSettings');
            if (value === null || value === undefined) return;
            await settings.updateOne(
                {key},
                {$set: {key, value}},
                {upsert: true},
            );
        };
        if (bundle.site.siteFlags !== undefined) await putSetting('siteFlags', bundle.site.siteFlags);
        if (bundle.site.footer !== undefined) await putSetting('footer', bundle.site.footer);
        if (bundle.site.siteSeo !== undefined) await putSetting('siteSeo', bundle.site.siteSeo);

        return {restored, assets: assetsWritten, skippedAssets};
    }
}
