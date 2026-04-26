#!/usr/bin/env node
// Patch SEO defaults on a SkyClimber bundle export. The live admin export
// leaves `site.siteSeo` mostly null because the operator never opened the
// SEO settings panel — search engines then see the per-nav `description`
// but nothing to anchor canonical / Open Graph / Twitter / locale tags.
//
// Reads:  public/Skyclimber/v5.json
// Writes: public/Skyclimber/v5.seo.json (next to the source — keeps v5.json
//         intact in case the import goes sideways and we need to compare).
//
// Run: node scripts/fixSkyclimberSeo.cjs

const fs = require('fs');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'public', 'Skyclimber', 'v5.json');
const OUT = path.resolve(__dirname, '..', 'public', 'Skyclimber', 'v5.seo.json');

const DOMAIN = 'https://skyclimber.pro';

// Pulled from the nav entry's existing copy so the global default matches
// what the operator already authored on the home page.
const SITE_DEFAULTS = {
    siteName: 'SkyClimber',
    defaultDescription:
        'SkyClimber — strādājam augstumos, kur citi nespēj sasniegt. Virves piekļuves pakalpojumi visā Latvijā: fasāžu, jumta, logu, krāsošanas un koku zāģēšanas darbi.',
    defaultKeywords: [
        'industriālais alpīnisms',
        'virves piekļuve',
        'augstuma darbi',
        'fasādes darbi',
        'jumta darbi',
        'logu mazgāšana',
        'koku zāģēšana',
        'SkyClimber',
        'Latvija',
    ],
    // Existing operator-set image — promoted to the site-wide OG default so
    // every page without its own `seo.image` still has a card preview.
    defaultImage: 'api/canopycreekautumn22560.jpg',
    primaryDomain: DOMAIN,
    twitterHandle: null,
    defaultAuthor: 'SkyClimber',
    defaultLocale: 'lv',
};

// Slugify the same way `@utils/pagePath#pageNameToPath` would, but inline
// so this script stays dependency-free.
function pageNameToPath(name) {
    return '/' + String(name)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]+/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function isHome(name, firstName) {
    if (!name) return false;
    if (name === firstName) return true; // positional rule (matches revalidate.ts)
    return name.trim().toLowerCase() === 'home';
}

function main() {
    const raw = fs.readFileSync(SRC, 'utf-8');
    const bundle = JSON.parse(raw);

    bundle.site = bundle.site || {};
    bundle.site.siteSeo = {...(bundle.site.siteSeo || {}), ...SITE_DEFAULTS};

    const nav = Array.isArray(bundle.site.navigation) ? bundle.site.navigation : [];
    const firstName = nav[0]?.page;

    // Fill per-nav `url` and inherit the default image where blank, so the
    // bundle is renderable on first paint without forcing the operator to
    // re-open every page's SEO panel.
    let touched = 0;
    for (const entry of nav) {
        if (!entry?.seo) continue;
        const seo = entry.seo;
        const subpath = isHome(entry.page, firstName) ? '/' : pageNameToPath(entry.page);
        const wantUrl = DOMAIN + (subpath === '/' ? '/' : subpath);
        if (!seo.url) { seo.url = wantUrl; touched++; }
        if (!seo.image) { seo.image = SITE_DEFAULTS.defaultImage; touched++; }
        if (!seo.image_alt) { seo.image_alt = `${SITE_DEFAULTS.siteName} — ${entry.page}`; touched++; }
        if (!seo.locale) { seo.locale = SITE_DEFAULTS.defaultLocale; touched++; }
        if (!seo.author) { seo.author = SITE_DEFAULTS.defaultAuthor; touched++; }
    }

    // Bump exportedAt so the next import audit shows this as a distinct
    // generation rather than colliding with the original v5 timestamp.
    bundle.manifest = {
        ...bundle.manifest,
        exportedAt: new Date().toISOString(),
        note: ' [seo-patched]',
    };

    fs.writeFileSync(OUT, JSON.stringify(bundle), 'utf-8');
    const sizeMB = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
    console.log(`[seo] wrote ${OUT} (${sizeMB} MB)`);
    console.log(`[seo] siteSeo defaults applied`);
    console.log(`[seo] nav fields filled: ${touched}`);
    console.log(`[seo] domain: ${DOMAIN}`);
}

main();
