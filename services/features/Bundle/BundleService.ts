import fs from 'fs/promises';
import path from 'node:path';
import type {Collection, Db} from 'mongodb';
import {validateSectionInput} from '@utils/contentSchemas';
import {PRESETS} from '@services/features/Themes/ThemeService';
import {markRestartRequired} from '@services/infra/restartRequired';
import guid from '@utils/guid';
import FileManager from '@services/infra/fileManager';
import {log} from '@services/infra/logger';

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), 'ui/client/public/images');
const IMAGE_PATH_PREFIX = 'api/';
const BUNDLE_VERSION = 1;

interface LanguageRowLike {
    symbol?: string;
}

/**
 * Return the set of language symbols present in the imported bundle but
 * absent from the runtime `next-i18next.config.js` locale list.
 *
 * Exported for tests; callers in the import path use this to decide
 * whether to surface a locale-drift restart-required banner. Pure —
 * does not read the filesystem unless `configLocales` is omitted, in
 * which case it best-effort reads the repo-root `next-i18next.config.js`.
 * A read failure returns `[]` (fail-open — the rest of the import is
 * more important than this one warning).
 */
export function detectLocaleDrift(
    languages: ReadonlyArray<LanguageRowLike>,
    configLocales?: ReadonlyArray<string>,
): string[] {
    const locales = configLocales ?? readConfigLocales();
    if (!locales) return [];
    const configured = new Set(locales);
    const seen = new Set<string>();
    const drift: string[] = [];
    for (const lang of languages) {
        const sym = lang?.symbol?.trim();
        if (!sym) continue;
        if (seen.has(sym)) continue;
        seen.add(sym);
        if (!configured.has(sym)) drift.push(sym);
    }
    return drift;
}

function readConfigLocales(): readonly string[] | null {
    try {
        // Static relative path (not `path.join(process.cwd(), …)`): a
        // computed `require()` argument is unresolvable for the Turbopack
        // bundler — it can't trace `process.cwd()` and aborts the build.
        // `next-i18next.config.js` lives at the repo root, three levels up.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const cfg = require('../../../next-i18next.config.js');
        const locales = cfg?.i18n?.locales;
        return Array.isArray(locales) ? locales.filter((l): l is string => typeof l === 'string') : null;
    } catch (err) {
        log.warn({scope: 'bundle.localeDriftReadFail', err}, 'could not read next-i18next.config.js locale list');
        return null;
    }
}

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

/** Extract local asset filenames from arbitrary JSON content.
 *
 * Section items store their payload as a JSON-stringified `content` field
 * (e.g. Hero's `{"portraitImage":"api/foo.jpg","bgImage":"api/bar.jpg",...}`),
 * so a naive walk treats the whole blob as one string that doesn't begin
 * with `api/` and silently drops every nested asset. We try `JSON.parse`
 * on string nodes that look structured (start with `{`/`[`) and recurse
 * into the parsed shape — that's how Hero's `portraitImage` / `bgImage`,
 * RichText `value` HTML attachments, etc. are discovered alongside the
 * top-level Images-collection entries (which Gallery / PlainImage already
 * surface naturally because they reference items in `Images` whose
 * `location` is a flat string).
 */
const collectLocalAssets = (node: unknown, out: Set<string>): void => {
    if (!node) return;
    if (typeof node === 'string') {
        if (node.startsWith(IMAGE_PATH_PREFIX) || node.startsWith('/' + IMAGE_PATH_PREFIX)) {
            out.add(node.replace(/^\//, '').slice(IMAGE_PATH_PREFIX.length));
            return;
        }
        const trimmed = node.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                const parsed = JSON.parse(trimmed);
                collectLocalAssets(parsed, out);
            } catch { /* not JSON — leave as-is */ }
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

    /**
     * Optional progress callback. Best-effort — failures inside the
     * callback are swallowed so a misbehaving notifier never aborts the
     * export. Wired by the MCP `bundle.export` tool when the client
     * passes `_meta.progressToken`.
     */
    async export(onProgress?: (p: {progress: number; total: number; message: string}) => Promise<void>): Promise<SiteBundle> {
        // Total = 7 phases: collections → site object → asset scan → asset
        // base64 read → manifest. Each `notify` call is wrapped in
        // try/catch so progress reporting can never abort the work.
        const TOTAL_PHASES = 6;
        const tick = async (progress: number, message: string): Promise<void> => {
            if (!onProgress) return;
            try { await onProgress({progress, total: TOTAL_PHASES, message}); } catch { /* swallow */ }
        };

        await tick(0, 'Reading collections');
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
        await tick(1, 'Collections loaded');

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

        await tick(2, 'Stripping mongo ids');

        const localAssets = new Set<string>();
        collectLocalAssets(site, localAssets);
        await tick(3, `Scanning ${localAssets.size} referenced assets`);

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
                log.warn({scope: 'bundle.export', err, asset: name}, 'missing asset on disk, skipping');
            }
        }
        await tick(4, `Encoded ${Object.keys(assets).length} assets`);

        const result: SiteBundle = {
            manifest: {
                version: BUNDLE_VERSION,
                exportedAt: new Date().toISOString(),
                app: 'redis-node-js-cloud',
            },
            site,
            assets,
        };
        await tick(6, 'Bundle ready');
        return result;
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

        // Allowed image extensions only; the body of the basename is sanitized
        // (spaces / parens / unicode chars are normalized) so common camera +
        // screenshot filenames like `IMG_0001 (1).jpg` or `Screenshot 2026-04-26.png`
        // round-trip cleanly. Hard rejects: null byte, control char, empty stem,
        // `..` segments, path separators, disallowed extension.
        const ALLOWED_EXT = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
        const MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25 MB per image
        const DATA_URI = /^data:image\/(jpeg|png|gif|webp|svg\+xml);base64,(.*)$/;

        // mcp-rollout-aftermath #12 — the previous sanitiser was too
        // aggressive: it replaced parens / spaces / plus signs with `_`,
        // so `20260426_162153(0).jpg` landed on disk as
        // `20260426_162153_0_.jpg` while the DB still referenced the
        // original name. Net effect: hero portraits 404'd silently
        // post-import, operator saw a "double background" broken-image
        // icon. Tightened: only reject security-critical chars (null
        // bytes, control chars, traversal segments, path separators).
        // Common-case filenames (parens, spaces, plus, accented Latin)
        // round-trip unchanged.
        const sanitizeAssetName = (raw: string): string | null => {
            const base = path.basename(raw);
            if (!base) return null;
            // Hard reject: null byte / control char.
            if (/[\x00-\x1f\x7f]/.test(base)) return null;
            // Hard reject: traversal segments / path separators.
            if (base === '..' || base.split(/[\\/]/).some(s => s === '..')) return null;
            if (/[\\/]/.test(base)) return null;
            // Hard reject: empty stem (e.g. `.png`) or just dots.
            if (base === '.' || base === '..') return null;
            if (base.startsWith('.') && base.indexOf('.', 1) === -1) return null;
            if (!ALLOWED_EXT.test(base)) return null;
            // Collapse whitespace (preserves operator-readable shape but
            // avoids URL-encoding pitfalls) — but DON'T strip the
            // pleasantries operators rely on (parens, plus, etc.).
            const cleaned = base.replace(/\s+/g, ' ').trim();
            if (!cleaned) return null;
            return cleaned;
        };

        let assetsWritten = 0;
        const skippedAssets: string[] = [];

        for (const [name, dataUri] of Object.entries(bundle.assets ?? {})) {
            const safeName = sanitizeAssetName(name);
            if (!safeName) {
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

        // Mongo is the authoritative store, but next-i18next's HTTP backend
        // serves runtime translations from `ui/client/public/locales/<sym>/app.json`.
        // `LanguageService.addUpdateLanguage` keeps the two in sync on each
        // admin save, but the bundle import path wrote straight into Mongo
        // and skipped the disk side — so after `import` the public site kept
        // its old (or empty) on-disk translations and the language switcher
        // appeared broken (e.g. switching to English on funisimo.pro showed
        // raw keys / Latvian fallback because `en/app.json` never got the
        // imported strings). Mirror every imported language to disk here.
        const fileManager = new FileManager();
        for (const lang of (bundle.site.languages ?? []) as Array<{symbol?: string; translations?: Record<string, string>}>) {
            if (!lang?.symbol) continue;
            try {
                fileManager.saveTranslation(lang.symbol, (lang.translations ?? {}) as unknown as JSON);
            } catch (err) {
                log.error({scope: 'bundle.import', err, symbol: lang.symbol}, 'failed writing translations');
            }
        }
        await put('Images', bundle.site.images ?? []);
        await put('Logos', bundle.site.logo ? [bundle.site.logo] : []);
        if (bundle.site.themes !== undefined) {
            await put('Themes', bundle.site.themes);
        }
        // If the bundle left the Themes collection empty (e.g. a pre-themes
        // export), seed the built-in presets so the site is never theme-less.
        const themeCount = await this.col('Themes').estimatedDocumentCount();
        if (themeCount === 0) {
            const seedDocs = PRESETS.map(p => ({id: guid(), ...p}));
            await this.col('Themes').insertMany(seedDocs as any);
            await this.col('SiteSettings').updateOne(
                {key: 'activeThemeId'},
                {$set: {key: 'activeThemeId', value: seedDocs[0].id}},
                {upsert: true},
            );
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

        // Locale-drift detection — bundle ships languages whose symbol set
        // differs from the runtime `next-i18next.config.js` locale list.
        // Next.js i18n is static (locales baked into URL routing at build
        // time), so a new symbol in the bundle won't serve until both the
        // file is edited AND the process is restarted. Without this signal
        // the operator imports the bundle, the language appears in the
        // admin Languages pane, but `/en/...` 404s for the new symbol
        // (the locale-stale errors seen on the skyclimber import).
        const driftSymbols = detectLocaleDrift(bundle.site.languages ?? []);
        if (driftSymbols.length > 0) {
            markRestartRequired({
                source: 'i18n',
                key: 'bundle-locale-drift',
                detail: `Imported bundle introduces locale${driftSymbols.length === 1 ? '' : 's'} not in next-i18next.config.js: ${driftSymbols.join(', ')}. Add to i18n.locales and restart to serve them.`,
            });
        }

        // Wave 3 — surface the "restart to pick up new modules" hint.
        // A bundle import can ship new modules / item types whose
        // ServiceLoader registration only runs at server boot; without
        // a restart their resolvers + UI loaders won't be wired even
        // though the bundle data lives in Mongo. The admin restart
        // banner reads `getRestartReasons()` and surfaces this to
        // the operator.
        markRestartRequired({
            source: 'bundle-import',
            detail: `Bundle imported (${assetsWritten} asset${assetsWritten === 1 ? '' : 's'} written, ${Object.keys(restored).length} collections restored). Restart to pick up any newly-registered modules.`,
        });

        return {restored, assets: assetsWritten, skippedAssets};
    }
}
