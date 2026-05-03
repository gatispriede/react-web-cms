#!/usr/bin/env node
/**
 * Build `tests/e2e/fixtures/bundles/docs-bundle.json` from `docs/site/*.md`.
 *
 * Each markdown file becomes one CMS page; the page has a single 1-column
 * section containing one RichText module whose `content.value` is HTML
 * converted from the markdown source. Slug is derived from the file path
 * (e.g. `docs/site/features/themes.md` → `Docs Themes`, slug `docs-themes`,
 * surfaced at `/docs/themes` by the docs route).
 *
 * The conversion is intentionally tiny — no `marked`, no `remark`. Docs are
 * authored by us; we only need headings, paragraphs, lists, code blocks,
 * inline code, bold, italic, and links. Anything more elaborate either
 * shouldn't be in docs or can be added later.
 *
 * Re-run after editing markdown:
 *
 *     node tools/seed-docs-bundle.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(ROOT, 'docs', 'site');
const OUT = path.join(ROOT, 'tests', 'e2e', 'fixtures', 'bundles', 'docs-bundle.json');

/** Escape a string for use as raw HTML text. */
function esc(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Inline conversions: `code`, **bold**, *italic*, [text](url). Order matters. */
function inline(s) {
    let out = esc(s);
    // `code`
    out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    // **bold**
    out = out.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`);
    // *italic*
    out = out.replace(/(^|[^*])\*([^*]+)\*/g, (_, p, c) => `${p}<em>${c}</em>`);
    // [text](url)
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${esc(u)}">${t}</a>`);
    return out;
}

/**
 * Markdown → HTML. Block-level scan with a tiny state machine:
 * - fenced code (```), atx headings (#…######), bullet lists (`- ` / `* `),
 * - numbered lists (`1. `), blank lines split paragraphs.
 */
function mdToHtml(md) {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    let para = [];
    let list = null; // {tag: 'ul'|'ol', items: string[]}

    const flushPara = () => {
        if (para.length) {
            out.push(`<p>${inline(para.join(' '))}</p>`);
            para = [];
        }
    };
    const flushList = () => {
        if (list) {
            const items = list.items.map(t => `<li>${inline(t)}</li>`).join('');
            out.push(`<${list.tag}>${items}</${list.tag}>`);
            list = null;
        }
    };
    const flushAll = () => { flushPara(); flushList(); };

    while (i < lines.length) {
        const line = lines[i];
        // Fenced code
        const fence = line.match(/^```([\w-]*)\s*$/);
        if (fence) {
            flushAll();
            const lang = fence[1];
            const buf = [];
            i++;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) {
                buf.push(lines[i]);
                i++;
            }
            i++; // skip closing fence
            const cls = lang ? ` class="language-${esc(lang)}"` : '';
            out.push(`<pre><code${cls}>${esc(buf.join('\n'))}</code></pre>`);
            continue;
        }
        // Heading
        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
            flushAll();
            const level = h[1].length;
            out.push(`<h${level}>${inline(h[2].trim())}</h${level}>`);
            i++;
            continue;
        }
        // Blank line
        if (/^\s*$/.test(line)) {
            flushAll();
            i++;
            continue;
        }
        // Bullet list item
        const bul = line.match(/^[-*]\s+(.*)$/);
        if (bul) {
            flushPara();
            if (!list || list.tag !== 'ul') { flushList(); list = {tag: 'ul', items: []}; }
            list.items.push(bul[1]);
            i++;
            continue;
        }
        // Numbered list item
        const num = line.match(/^\d+\.\s+(.*)$/);
        if (num) {
            flushPara();
            if (!list || list.tag !== 'ol') { flushList(); list = {tag: 'ol', items: []}; }
            list.items.push(num[1]);
            i++;
            continue;
        }
        // Paragraph continuation
        flushList();
        para.push(line.trim());
        i++;
    }
    flushAll();
    return out.join('\n');
}

/** Walk `docs/site/` and return [{slug, page, title, html, srcRel}]. */
function collectPages(dir, prefix = '') {
    const out = [];
    for (const name of fs.readdirSync(dir).sort()) {
        const abs = path.join(dir, name);
        const stat = fs.statSync(abs);
        if (stat.isDirectory()) {
            out.push(...collectPages(abs, prefix ? `${prefix}-${name}` : name));
            continue;
        }
        if (!name.endsWith('.md')) continue;
        if (name.toLowerCase() === 'readme.md') continue; // index handled by /docs route
        const stem = name.replace(/\.md$/, '');
        const slug = prefix ? `${prefix}-${stem}` : stem;
        const md = fs.readFileSync(abs, 'utf8');
        // Title = first H1 if present, else slug-cased.
        const titleMatch = md.match(/^#\s+(.*)$/m);
        const title = titleMatch ? titleMatch[1].trim() : stem.replace(/-/g, ' ');
        const page = `Docs ${title}`;
        out.push({
            slug,
            page,
            title,
            html: mdToHtml(md),
            srcRel: path.relative(ROOT, abs).replace(/\\/g, '/'),
        });
    }
    return out;
}

function buildBundle(pages) {
    const navigation = [];
    const sections = [];
    for (const p of pages) {
        const sectionId = `docs-sec-${p.slug}`;
        const navId = `docs-nav-${p.slug}`;
        navigation.push({
            id: navId,
            type: 'navigation',
            page: p.page,
            seo: {
                title: `${p.title} — Docs`,
                description: `Documentation: ${p.title}.`,
                viewport: 'width=device-width,initial-scale=1',
                charSet: 'utf-8',
                locale: 'en',
            },
            sections: [sectionId],
        });
        sections.push({
            id: sectionId,
            type: 1,
            page: p.page,
            slots: [1],
            content: [{
                type: 'RICH_TEXT',
                style: 'default',
                name: p.title,
                content: JSON.stringify({value: p.html}),
            }],
        });
    }
    return {
        manifest: {
            version: 1,
            exportedAt: new Date().toISOString(),
            app: 'redis-node-js-cloud',
        },
        site: {
            navigation,
            sections,
            languages: [{label: 'English', symbol: 'en', flag: 'EN', default: true, translations: {}}],
            images: [],
            logo: null,
            themes: [],
            posts: [],
            siteFlags: {blogEnabled: false, layoutMode: 'tabs'},
        },
        assets: {},
    };
}

function main() {
    const pages = collectPages(SITE_DIR);
    if (!pages.length) {
        console.error('seed-docs-bundle: no markdown files found under', SITE_DIR);
        process.exit(1);
    }
    const bundle = buildBundle(pages);
    fs.mkdirSync(path.dirname(OUT), {recursive: true});
    fs.writeFileSync(OUT, JSON.stringify(bundle, null, 2));
    console.log(`seed-docs-bundle: wrote ${pages.length} pages → ${path.relative(ROOT, OUT).replace(/\\/g, '/')}`);
}

if (require.main === module) main();

module.exports = {mdToHtml, collectPages, buildBundle};
