#!/usr/bin/env node
/**
 * One-shot fixer: hoist `import './<Name>.scss'` from every module .tsx
 * into ui/client/pages/_app.tsx and strip the inline import.
 *
 * Next 16 / Turbopack forbids global CSS imports outside the Custom <App>.
 * Module files keep their SCSS files in place; the import statement
 * just moves to _app.tsx (the only file Turbopack permits).
 *
 * Idempotent: re-runnable without duplicating imports in _app.tsx.
 */
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.cwd();
const MODULES_DIR = path.join(REPO, 'ui/client/modules');
const APP_TSX = path.join(REPO, 'ui/client/pages/_app.tsx');

function walk(dir, acc) {
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, acc);
        else if ((e.name.endsWith('.tsx') || e.name.endsWith('.ts')) && !e.name.endsWith('.test.tsx') && !e.name.endsWith('.test.ts') && !e.name.endsWith('.stories.tsx') && !e.name.endsWith('.types.ts')) acc.push(p);
    }
    return acc;
}

const tsxFiles = walk(MODULES_DIR, []);
const hoisted = new Set();

for (const tsx of tsxFiles) {
    const src = fs.readFileSync(tsx, 'utf8');
    const re = /^import\s+['"](\.\/.+?\.scss)['"];?\s*$/gm;
    let modified = src;
    let match;
    let removed = false;
    while ((match = re.exec(src)) !== null) {
        const rel = match[1];                       // e.g. './Breadcrumb.scss'
        const tsxDir = path.dirname(tsx);
        const scssAbs = path.resolve(tsxDir, rel);  // absolute path to the .scss file
        // Compute import path relative to _app.tsx
        const appDir = path.dirname(APP_TSX);
        const fromApp = path.relative(appDir, scssAbs).replace(/\\/g, '/');
        const importPath = fromApp.startsWith('.') ? fromApp : `./${fromApp}`;
        hoisted.add(importPath);
        removed = true;
    }
    if (removed) {
        modified = modified.replace(re, '');
        // collapse 2+ consecutive blank lines (sweep leaves a blank line behind)
        modified = modified.replace(/\n{3,}/g, '\n\n');
        fs.writeFileSync(tsx, modified);
    }
}

// Now patch _app.tsx: add any missing imports right after the existing block.
let app = fs.readFileSync(APP_TSX, 'utf8');
const existing = new Set(
    [...app.matchAll(/^import\s+['"](\..+?\.scss)['"];?\s*$/gm)].map(m => m[1]),
);

const newImports = [...hoisted].filter(p => !existing.has(p)).sort();
if (newImports.length === 0) {
    console.log(`no new imports to hoist (existing: ${existing.size}, candidates: ${hoisted.size})`);
    process.exit(0);
}

// Find the last existing SCSS import line in _app.tsx and append after it.
const lines = app.split('\n');
let lastScssLine = -1;
for (let i = 0; i < lines.length; i++) {
    if (/^import\s+['"](\..+?\.scss)['"];?\s*$/.test(lines[i])) lastScssLine = i;
}
if (lastScssLine === -1) {
    console.error('cannot locate existing SCSS import block in _app.tsx — aborting');
    process.exit(1);
}

const insertion = newImports.map(p => `import '${p}'`);
lines.splice(lastScssLine + 1, 0, ...insertion);
fs.writeFileSync(APP_TSX, lines.join('\n'));

console.log(`hoisted ${newImports.length} new SCSS imports into _app.tsx (${tsxFiles.length} module files scanned)`);
for (const p of newImports) console.log(`  + ${p}`);
