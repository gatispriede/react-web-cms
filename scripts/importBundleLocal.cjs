#!/usr/bin/env node
// One-off local importer. Reads public/CV/v3/site-2026-04-25.json and writes:
//   - Mongo: replaces Sections, Navigation, Languages collections wholesale
//             (matches BundleService.import — non-destructive to Themes/Posts/etc.
//              when those keys are absent, which is the cv-bundle case).
//   - Disk:  mirrors each language's translations to
//             ui/client/public/locales/<sym>/app.json so next-i18next sees them.
//
// Why a script instead of /api/import? The HTTP path requires same-origin +
// admin session cookie + a 50MB request body, and Next.js's public/ static
// serving was returning the SPA shell for the bundle URL (catch-all route).
// Bypassing both layers is the simplest path to a clean local restore.
//
// Run: node scripts/importBundleLocal.cjs [path-to-bundle.json]

const fs = require('fs');
const path = require('path');
const {MongoClient} = require('mongodb');

const REPO = path.resolve(__dirname, '..');
const DEFAULT_BUNDLE = path.join(REPO, 'public/CV/v3/site-2026-04-25.json');
const LOCALES_DIR = path.join(REPO, 'ui/client/public/locales');
const PUBLIC_IMAGES_DIR = path.join(REPO, 'ui/client/public/images');

const MONGO_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const MONGO_DB = process.env.MONGODB_DB ?? 'MAIN-DB';

async function main() {
    const bundlePath = process.argv[2] || DEFAULT_BUNDLE;
    console.log(`[import] bundle: ${bundlePath}`);
    console.log(`[import] mongo:  ${MONGO_URI} / ${MONGO_DB}`);

    const raw = fs.readFileSync(bundlePath, 'utf-8');
    const bundle = JSON.parse(raw);
    if (!bundle?.manifest || !bundle?.site) throw new Error('bundle missing manifest/site');

    const client = new MongoClient(MONGO_URI);
    await client.connect();
    try {
        const db = client.db(MONGO_DB);

        const put = async (name, docs) => {
            const col = db.collection(name);
            await col.deleteMany({});
            if (docs?.length) await col.insertMany(docs);
            console.log(`[mongo] ${name}: ${docs?.length ?? 0}`);
        };

        await put('Navigation', bundle.site.navigation ?? []);
        await put('Sections', bundle.site.sections ?? []);
        await put('Languages', bundle.site.languages ?? []);
        await put('Images', bundle.site.images ?? []);
        await put('Logos', bundle.site.logo ? [bundle.site.logo] : []);
        if (Array.isArray(bundle.site.themes)) await put('Themes', bundle.site.themes);
        if (Array.isArray(bundle.site.posts))   await put('Posts', bundle.site.posts);

        const settings = db.collection('SiteSettings');
        const upsert = async (key, value) => {
            if (value === null || value === undefined) return;
            await settings.updateOne({key}, {$set: {key, value}}, {upsert: true});
            console.log(`[mongo] SiteSettings/${key} upserted`);
        };
        await upsert('activeThemeId', bundle.site.activeThemeId);
        await upsert('siteFlags', bundle.site.siteFlags);
        await upsert('footer', bundle.site.footer);
        await upsert('siteSeo', bundle.site.siteSeo);

        // Mirror translations to disk so next-i18next HTTP backend serves them.
        for (const lang of bundle.site.languages ?? []) {
            if (!lang?.symbol) continue;
            const dir = path.join(LOCALES_DIR, lang.symbol);
            fs.mkdirSync(dir, {recursive: true});
            const file = path.join(dir, 'app.json');
            const data = lang.translations ?? {};
            fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`[disk] ${file} (${Object.keys(data).length} keys)`);
        }

        // Decode bundle assets to disk.
        if (bundle.assets && typeof bundle.assets === 'object') {
            fs.mkdirSync(PUBLIC_IMAGES_DIR, {recursive: true});
            const SAFE = /^[\w.\-]+\.(jpg|jpeg|png|gif|webp|svg)$/i;
            const URI = /^data:image\/(jpeg|png|gif|webp|svg\+xml);base64,(.*)$/;
            let n = 0, skipped = 0;
            for (const [name, dataUri] of Object.entries(bundle.assets)) {
                const safe = path.basename(name);
                if (!SAFE.test(safe)) { skipped++; continue; }
                const m = URI.exec(String(dataUri));
                if (!m) { skipped++; continue; }
                fs.writeFileSync(path.join(PUBLIC_IMAGES_DIR, safe), Buffer.from(m[2], 'base64'));
                n++;
            }
            console.log(`[disk] assets: ${n} written, ${skipped} skipped`);
        }

        console.log('[import] done');
    } finally {
        await client.close();
    }
}

main().catch(e => { console.error('[import] failed:', e); process.exit(1); });
