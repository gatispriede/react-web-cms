#!/usr/bin/env node
/**
 * Theme palette contrast audit — Wave 8a.
 *
 * Walks every `services/themes/*\/theme.json`, computes WCAG 2.x contrast
 * ratios for the meaningful palette pairs (text-on-surface, ink-on-inset,
 * accent-on-surface, accentInk-on-accent) in both light and dark modes,
 * and reports each pair against:
 *   - 4.5 : 1 — WCAG AA normal text
 *   - 3.0 : 1 — WCAG AA large text / non-text contrast (UI components)
 *
 * Placeholder themes (`placeholder: true` in the manifest) emit a warning
 * line so the operator knows which themes still need a real design pass
 * before they can ship to public-internet. Non-placeholder themes that
 * fail AA exit non-zero — these are real shipping bugs.
 *
 * Local: `npm run a11y:contrast`. Manual pre-launch step; not wired into
 * CI by default because placeholder themes intentionally fail until their
 * real design lands.
 */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const THEMES_ROOT = resolve(REPO_ROOT, 'services', 'themes');

// ----- WCAG 2.x relative luminance + contrast ratio -----

function srgbChannelToLinear(c) {
    const n = c / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!m) throw new Error(`bad hex color: ${hex}`);
    const v = parseInt(m[1], 16);
    const r = (v >> 16) & 0xff;
    const g = (v >>  8) & 0xff;
    const b =  v        & 0xff;
    return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
}

function contrastRatio(fg, bg) {
    const L1 = relativeLuminance(fg);
    const L2 = relativeLuminance(bg);
    const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
    return (hi + 0.05) / (lo + 0.05);
}

// ----- Audit -----

const PAIRS = [
    {label: 'ink on surface',           fg: 'ink',       bg: 'surface',      min: 4.5, kind: 'text'},
    {label: 'ink on surfaceInset',      fg: 'ink',       bg: 'surfaceInset', min: 4.5, kind: 'text'},
    {label: 'accent on surface',        fg: 'accent',    bg: 'surface',      min: 3.0, kind: 'large/UI'},
    {label: 'accentInk on accent',      fg: 'accentInk', bg: 'accent',       min: 4.5, kind: 'text'},
];

function auditTheme(slug, manifest) {
    const out = {slug, placeholder: !!manifest.placeholder, modes: {}, failures: []};
    for (const mode of ['light', 'dark']) {
        const rows = [];
        for (const pair of PAIRS) {
            const fgHex = manifest.palette?.[pair.fg]?.[mode];
            const bgHex = manifest.palette?.[pair.bg]?.[mode];
            if (!fgHex || !bgHex) {
                rows.push({...pair, mode, ratio: null, ok: false, missing: true});
                out.failures.push({mode, pair: pair.label, reason: 'missing palette key'});
                continue;
            }
            let ratio;
            try {
                ratio = contrastRatio(fgHex, bgHex);
            } catch (err) {
                rows.push({...pair, mode, ratio: null, ok: false, error: String(err.message)});
                out.failures.push({mode, pair: pair.label, reason: err.message});
                continue;
            }
            const ok = ratio >= pair.min;
            rows.push({...pair, mode, ratio, ok, fgHex, bgHex});
            if (!ok) out.failures.push({mode, pair: pair.label, ratio: ratio.toFixed(2), min: pair.min});
        }
        out.modes[mode] = rows;
    }
    return out;
}

function fmtRatio(n) {
    if (n == null) return ' —  ';
    return `${n.toFixed(2).padStart(5)}:1`;
}

function main() {
    let themes;
    try {
        themes = readdirSync(THEMES_ROOT)
            .filter(d => statSync(join(THEMES_ROOT, d)).isDirectory())
            .sort();
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[contrast-audit] cannot read ${THEMES_ROOT}: ${err.message}`);
        process.exit(1);
    }

    const reports = [];
    for (const slug of themes) {
        const manifestPath = join(THEMES_ROOT, slug, 'theme.json');
        let manifest;
        try {
            manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
        } catch {
            // eslint-disable-next-line no-console
            console.warn(`[contrast-audit] skipping ${slug} — no theme.json`);
            continue;
        }
        reports.push(auditTheme(slug, manifest));
    }

    // Print human-readable table.
    let realFailures = 0;
    let placeholderFailures = 0;
    for (const r of reports) {
        // eslint-disable-next-line no-console
        console.log(`\n=== ${r.slug}${r.placeholder ? '  (placeholder)' : ''} ===`);
        for (const mode of ['light', 'dark']) {
            // eslint-disable-next-line no-console
            console.log(`  [${mode}]`);
            for (const row of r.modes[mode]) {
                const status = row.ok ? 'PASS' : row.missing ? 'MISS' : 'FAIL';
                // eslint-disable-next-line no-console
                console.log(`    ${status}  ${fmtRatio(row.ratio)}  (≥${row.min}:1, ${row.kind})  ${row.label}`);
            }
        }
        if (r.failures.length > 0) {
            if (r.placeholder) placeholderFailures += r.failures.length;
            else realFailures += r.failures.length;
        }
    }

    // eslint-disable-next-line no-console
    console.log(`\n[contrast-audit] real-theme failures: ${realFailures}; placeholder-theme failures (informational): ${placeholderFailures}`);
    if (placeholderFailures > 0) {
        // eslint-disable-next-line no-console
        console.log('[contrast-audit] placeholder themes (editorial / agency / commerce) are expected to fail until real designs land — informational only.');
    }
    process.exit(realFailures === 0 ? 0 : 1);
}

main();
