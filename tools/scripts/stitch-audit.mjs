#!/usr/bin/env node
/**
 * Walk the live CMS via the in-process MCP dispatcher and surface
 * RichText abuse patterns ranked by frequency. Answers "what should
 * we Stitch next?" without manual page-walking.
 *
 *   npm run stitch:audit [--limit N] [--page <name>]
 *
 * Patterns detected:
 *   - `<dl><dt><dd>` blocks  → candidate: KeyValueDossier
 *   - `<h2>…</h2>\s*<p><em>` → candidate: SectionHeading
 *   - `<ul><li><strong>…</strong>` repeated → candidate: FactList
 *   - Bare `class="..."` in RichText → operator already wanting a module
 *
 * Output: markdown table per pattern with section ids + per-page counts.
 * Dispatches through `tools/scripts/mcp-call.mjs` for each tool call so
 * scope checks + audit logging stay consistent.
 */
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// Invoke the mcp-call script directly with node — bypasses the npm shell
// wrapper that strips JSON quotes on Windows when shell:true is set.
const MCP_CALL = path.join(REPO_ROOT, 'tools', 'scripts', 'mcp-call.mjs');

function callTool(name, args = {}) {
    const r = spawnSync(
        process.execPath, [MCP_CALL, name, JSON.stringify(args)],
        {cwd: REPO_ROOT, encoding: 'utf8'},
    );
    if (r.error) {
        console.error(`[audit] spawn error for ${name}:`, r.error.message);
        return null;
    }
    if (r.status !== 0) {
        console.error(`[audit] ${name} failed (status ${r.status}):`, (r.stderr ?? '').slice(-500));
        return null;
    }
    // mcp:call prints noisy log lines (and progress) before/after the
    // JSON envelope. Find the envelope by locating its opening `{\n  "ok"`.
    const out = r.stdout;
    const start = out.indexOf('{\n  "ok"');
    if (start < 0) {
        console.error(`[audit] no envelope in stdout for ${name} — first 200:`, out.slice(0, 200));
        return null;
    }
    try {
        const env = JSON.parse(out.slice(start));
        if (!env.ok) return null;
        return JSON.parse(env.result.content[0].text).data;
    } catch (err) {
        console.error('[audit] parse fail:', err.message);
        return null;
    }
}

const patterns = [
    {
        name: 'KeyValueDossier candidate (<dl><dt><dd>)',
        re: /<dl[\s>][\s\S]*?<\/dl>/i,
        countRe: /<dt[\s>]/gi,
    },
    {
        name: 'SectionHeading candidate (<h2>…<p><em>)',
        re: /<h[1-3][\s>][\s\S]*?<\/h[1-3]>\s*<p[\s>][\s\S]*?<em[\s>]/i,
        countRe: /<h[1-3][\s>]/gi,
    },
    {
        name: 'FactList candidate (<ul>…<li><strong>)',
        re: /<ul[\s>][\s\S]*?<li[\s>][\s\S]*?<strong[\s>][\s\S]*?<\/strong>[\s\S]*?<\/li>/i,
        countRe: /<li[\s>][\s\S]*?<strong[\s>]/gi,
    },
    {
        name: 'Hardcoded class= in RichText (operator wishing for a module)',
        re: /class=["'][a-zA-Z0-9_-]+["']/,
        countRe: /class=["'][a-zA-Z0-9_-]+["']/g,
    },
];

const args = process.argv.slice(2);
const pageFilter = args.includes('--page') ? args[args.indexOf('--page') + 1] : null;
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;

console.error('[audit] listing pages…');
const pages = callTool('page.list');
if (!pages) { console.error('page.list failed'); process.exit(1); }

const targetPages = (pageFilter ? pages.filter(p => p.page === pageFilter) : pages).slice(0, limit);
console.error(`[audit] walking ${targetPages.length} page(s)…`);

const findings = patterns.map(p => ({...p, hits: [], total: 0}));

for (const nav of targetPages) {
    const page = callTool('page.get', {page: nav.page});
    if (!page) { console.error(`[audit] page.get(${nav.page}) failed`); continue; }
    for (const sec of (page.sections ?? [])) {
        for (let i = 0; i < (sec.content ?? []).length; i++) {
            const item = sec.content[i];
            if (item.type !== 'RICH_TEXT') continue;
            let body = '';
            try { body = JSON.parse(item.content ?? '{}').value ?? ''; } catch { continue; }
            for (const pat of findings) {
                if (pat.re.test(body)) {
                    const occurrences = (body.match(pat.countRe) ?? []).length;
                    pat.hits.push({page: nav.page, sectionId: sec.id, at: i, occurrences});
                    pat.total += occurrences;
                }
            }
        }
    }
}

console.log('# Stitch audit — RichText abuse patterns');
console.log('');
console.log(`Walked ${targetPages.length} page(s) — ${new Date().toISOString()}`);
console.log('');

for (const pat of findings) {
    console.log(`## ${pat.name}`);
    console.log(`Total occurrences: **${pat.total}** across ${pat.hits.length} section(s)`);
    console.log('');
    if (pat.hits.length === 0) {
        console.log('_no matches_');
        console.log('');
        continue;
    }
    console.log('| Page | Section id | at | Occurrences |');
    console.log('|------|------------|----|-------------|');
    for (const h of pat.hits.sort((a, b) => b.occurrences - a.occurrences)) {
        console.log(`| ${h.page} | \`${h.sectionId}\` | ${h.at} | ${h.occurrences} |`);
    }
    console.log('');
}

console.log('---');
console.log('Highest-leverage candidates ranked by total occurrences. Reach for ones with multi-page footprint first.');
