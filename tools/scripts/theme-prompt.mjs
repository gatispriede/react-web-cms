#!/usr/bin/env node
/**
 * Print a theme's tokens formatted as a copy-paste prompt block for the
 * Stitch / Claude design step. Stops the "I guessed wrong tokens"
 * failure mode that bit us on module #1.
 *
 *   npm run theme:prompt <slug>
 *
 * Examples:
 *   npm run theme:prompt editorial
 *   npm run theme:prompt saas-landing
 */
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const THEMES_DIR = path.join(REPO_ROOT, 'services', 'themes');

const slug = process.argv[2];
if (!slug) {
    const known = readdirSync(THEMES_DIR)
        .filter(d => existsSync(path.join(THEMES_DIR, d, 'theme.json')))
        .sort();
    console.error('Usage: theme-prompt <slug>');
    console.error('Available themes: ' + known.join(', '));
    process.exit(2);
}

const themePath = path.join(THEMES_DIR, slug, 'theme.json');
if (!existsSync(themePath)) {
    console.error(`No theme at ${themePath}`);
    process.exit(2);
}

const t = JSON.parse(readFileSync(themePath, 'utf8'));
const pal = t.palette ?? {};
const typ = t.typography ?? {};
const hint = t.moduleStyleHints ?? {};

const mood = Array.isArray(t.mood) ? t.mood.join(', ') : (t.mood ?? '—');
const palLine = (k) => pal[k] ? `${k} ${pal[k].light}${pal[k].dark ? ` (light) / ${pal[k].dark} (dark)` : ''}` : null;
const palBlock = ['surface', 'ink', 'accent', 'accentInk', 'surfaceInset', 'rule']
    .map(palLine).filter(Boolean).join('\n  ');

const hintBlock = Object.keys(hint).length
    ? Object.entries(hint).map(([k, v]) => `  ${k}: ${v}`).join('\n')
    : '  (none)';

// Plain-text Markdown block — paste into any prompt verbatim.
console.log(`Active theme — \`${t.slug ?? slug}\`

- **name**: ${t.name ?? '—'}
- **tagline**: ${t.tagline ?? '—'}
- **mood**: ${mood}
- **darkDefault**: ${t.darkDefault === true ? 'yes' : 'no'}
- **palette (light / dark)**:
  ${palBlock}
- **typography**:
  - display: ${typ.display ?? '—'}
  - body:    ${typ.body ?? '—'}
  - mono:    ${typ.mono ?? '—'}
  - baseSize: ${typ.baseSize ?? '—'}px
- **motion**: ${t.motion ?? '—'}
- **headerBehavior**: ${t.headerBehavior ?? '—'}
- **footerLayout**: ${t.footerLayout ?? '—'}
- **logoLockup**: ${t.logoLockup ?? '—'}
- **moduleStyleHints**:
${hintBlock}
`);
