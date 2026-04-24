/**
 * Rebuild the [`google-fonts.json`](../../services/infra/data/google-fonts.json)
 * snapshot from the Google Fonts Developer API.
 *
 * The catalogue is hand-curated today — this script replaces that with a
 * reproducible pull. Keeps the same shape the in-app picker and
 * `googleFonts.buildGoogleFontsUrl` consume: `{family, category,
 * variants, subsets}`. Variants are trimmed to the canonical numeric
 * weights (400/500/600/700 by default — italic and oblique faces are
 * dropped to keep the picker scope sane).
 *
 * Usage (from repo root):
 *   GOOGLE_FONTS_API_KEY=xxx \
 *     npx tsx --tsconfig services/tsconfig.custom.json \
 *     tools/scripts/update-google-fonts.ts
 *
 * Dry-run by default. Pass `--apply` to overwrite the snapshot file and
 * `--all-categories` to keep every category the API exposes (today we
 * include sans-serif, serif, display, handwriting, monospace — which is
 * the full set, but the flag is there for future filter changes).
 */

/* eslint-disable no-console */

import fs from 'node:fs';
import path from 'node:path';

interface ApiFont {
    family: string;
    category: string;
    variants: string[];
    subsets: string[];
}

interface CatalogueFont {
    family: string;
    category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
    variants: string[];
    subsets: string[];
}

const OUT = path.join(process.cwd(), 'services/infra/data/google-fonts.json');

// Italic / weight-tag mapping. Google API reports `regular`, `italic`,
// `100italic`, `100`, ..., `900italic`. We drop italics (picker doesn't
// surface them separately) and normalise `regular` → `400`.
const WEIGHT_VARIANTS = new Set(['100', '200', '300', '400', '500', '600', '700', '800', '900']);

function normaliseVariants(variants: string[]): string[] {
    const out = new Set<string>();
    for (const v of variants) {
        if (v === 'regular') { out.add('400'); continue; }
        if (v === 'italic') { out.add('400'); continue; }
        if (v.endsWith('italic')) continue;
        if (WEIGHT_VARIANTS.has(v)) out.add(v);
    }
    return [...out].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

function normaliseCategory(cat: string): CatalogueFont['category'] | null {
    switch (cat) {
        case 'sans-serif':
        case 'serif':
        case 'display':
        case 'handwriting':
        case 'monospace':
            return cat;
        default:
            return null;
    }
}

async function fetchApi(key: string): Promise<ApiFont[]> {
    const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${encodeURIComponent(key)}&sort=popularity`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Google Fonts API returned ${res.status}: ${await res.text()}`);
    const data = await res.json() as {items?: ApiFont[]};
    if (!Array.isArray(data.items)) throw new Error('Unexpected API response — missing items[]');
    return data.items;
}

async function main(): Promise<void> {
    const apply = process.argv.includes('--apply');
    const apiKey = process.env.GOOGLE_FONTS_API_KEY;
    if (!apiKey) {
        console.error('GOOGLE_FONTS_API_KEY env var is required. Get one at https://developers.google.com/fonts/docs/developer_api.');
        process.exit(1);
    }

    console.log(apply ? '[apply] Rebuilding catalogue' : '[dry-run] Previewing catalogue rebuild');

    const raw = await fetchApi(apiKey);
    const transformed: CatalogueFont[] = [];
    let skippedCategory = 0;
    let skippedNoWeights = 0;

    for (const item of raw) {
        const cat = normaliseCategory(item.category);
        if (!cat) { skippedCategory++; continue; }
        const variants = normaliseVariants(item.variants ?? []);
        if (variants.length === 0) { skippedNoWeights++; continue; }
        transformed.push({
            family: item.family,
            category: cat,
            variants,
            subsets: Array.isArray(item.subsets) ? item.subsets : [],
        });
    }

    console.log(`Fetched ${raw.length} families; kept ${transformed.length} (skipped ${skippedCategory} for unknown category, ${skippedNoWeights} with no numeric weights).`);

    const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf-8')) : null;
    const existingFamilies = new Set<string>((existing?.fonts ?? []).map((f: CatalogueFont) => f.family));
    const newFamilies = new Set<string>(transformed.map(f => f.family));
    const added = [...newFamilies].filter(f => !existingFamilies.has(f));
    const removed = [...existingFamilies].filter(f => !newFamilies.has(f));
    console.log(`Diff vs current snapshot: +${added.length} added · -${removed.length} removed.`);
    if (added.length) console.log('  Added (first 10):', added.slice(0, 10).join(', '));
    if (removed.length) console.log('  Removed (first 10):', removed.slice(0, 10).join(', '));

    const snapshot = {
        _meta: {
            source: 'Google Fonts Developer API · tools/scripts/update-google-fonts.ts',
            updatedAt: new Date().toISOString().slice(0, 10),
            schema: 'family · category · variants · subsets',
            totalFamilies: transformed.length,
        },
        fonts: transformed,
    };

    if (!apply) {
        console.log('\nDry run complete. Re-run with --apply to write the snapshot.');
        return;
    }

    fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n');
    console.log(`\nWrote ${OUT}.`);
}

main().catch(err => { console.error(err); process.exit(1); });
