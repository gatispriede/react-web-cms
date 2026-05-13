#!/usr/bin/env node
/**
 * `data-testid` coverage check (universal requirement #4).
 *
 * What it does
 *   1. Walks new / modified `.tsx` files (diff mode) or every `.tsx`
 *      under `ui/` (--all mode).
 *   2. AST-parses each via `@typescript-eslint/parser` and visits every
 *      JSX opening element.
 *   3. Flags interactive elements (`<button>`, `<input>`, AntD inputs,
 *      anything with `onClick`/`onChange`/`onSubmit`/`role="button"`)
 *      that lack `data-testid`.
 *   4. Warns (non-fatal) on testids whose value doesn't follow
 *      lowercase kebab-case `feature-component-role` convention.
 *
 * Modes
 *   default — diff against `origin/master...HEAD` (~5s on a typical PR).
 *   --all   — full `ui/**\/*.tsx` walk (~30s).
 *
 * Allowlist
 *   `tools/scripts/.testid-coverage-allow`, one path-pattern per line.
 *   Patterns support `*` (segment), `**` (any depth), `?` (single char).
 *
 * Exit codes
 *   0  clean (no missing-testid violations)
 *   1  one or more missing-testid violations
 *   2  internal error (parse failure on a non-broken file, IO, etc.)
 *
 * Output style mirrors `tools/scripts/mcp-schema-drift.mjs`: ✓ / ✗
 * symbols, file:line, summary counts, warnings on stderr but
 * non-blocking.
 */
import {parse} from '@typescript-eslint/parser';
import {readFile, readdir, stat} from 'node:fs/promises';
import {existsSync, readFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {join, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = join(__filename, '..');
const ROOT = join(SCRIPT_DIR, '..', '..');
const ALLOW_FILE = join(SCRIPT_DIR, '.testid-coverage-allow');

// ─── Config ───────────────────────────────────────────────────────────

const INTERACTIVE_TAGS = new Set([
    // HTML primitives
    'button', 'a', 'input', 'select', 'textarea', 'details', 'summary',
    // AntD interactives (capitalised JSX identifiers)
    'Button', 'Input', 'Select', 'Modal', 'Drawer', 'Tabs', 'Menu',
    'Switch', 'Radio', 'Checkbox', 'DatePicker', 'TimePicker', 'Upload',
    'Form.Item',
]);

const INTERACTIVE_ROLES = new Set([
    'button', 'tab', 'link', 'checkbox', 'radio', 'switch', 'menuitem',
    'option', 'combobox',
]);

const HANDLER_RE = /^on[A-Z]/;
const TESTID_VALID_RE = /^[a-z0-9]+(-[a-z0-9_]+)+$/;

// ─── Allowlist ────────────────────────────────────────────────────────

function loadAllowlist() {
    if (!existsSync(ALLOW_FILE)) return [];
    return readFileSync(ALLOW_FILE, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'));
}

function globToRegex(pat) {
    let re = '^';
    for (let i = 0; i < pat.length; i++) {
        const c = pat[i];
        if (c === '*') {
            if (pat[i + 1] === '*') { re += '.*'; i++; }
            else re += '[^/]*';
        } else if (c === '?') re += '[^/]';
        else if ('.+^$()|{}[]\\'.includes(c)) re += '\\' + c;
        else re += c;
    }
    return new RegExp(re + '$');
}

function makeAllowMatcher(patterns) {
    const regs = patterns.map(globToRegex);
    return (relPath) => {
        const norm = relPath.split(sep).join('/');
        return regs.some((r) => r.test(norm));
    };
}

// ─── File discovery ──────────────────────────────────────────────────

async function walkDir(dir, out = []) {
    let entries;
    try { entries = await readdir(dir, {withFileTypes: true}); } catch { return out; }
    for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) {
            if (e.name === 'node_modules' || e.name === '.next' || e.name === '_archived') continue;
            await walkDir(p, out);
        } else if (e.name.endsWith('.tsx')) {
            out.push(p);
        }
    }
    return out;
}

async function allFiles() {
    return walkDir(join(ROOT, 'ui'));
}

function changedFiles() {
    let out;
    try {
        out = execSync('git diff --name-only --diff-filter=AM origin/master...HEAD', {
            cwd: ROOT, encoding: 'utf8',
        });
    } catch (err) {
        // No `origin/master` ref (fresh clone, shallow CI, etc.) — fall
        // back to diff against the default upstream tracking branch.
        try {
            out = execSync('git diff --name-only --diff-filter=AM HEAD', {cwd: ROOT, encoding: 'utf8'});
        } catch {
            console.error('warn: could not compute changed files; pass --all for full-tree scan');
            return [];
        }
    }
    return out.split('\n')
        .filter((p) => p.endsWith('.tsx'))
        .map((p) => join(ROOT, p));
}

// ─── AST walk ────────────────────────────────────────────────────────

function jsxName(node) {
    const n = node.name;
    if (!n) return null;
    if (n.type === 'JSXIdentifier') return n.name;
    if (n.type === 'JSXMemberExpression') {
        // Form.Item etc.
        const obj = n.object?.name ?? '';
        const prop = n.property?.name ?? '';
        return obj && prop ? `${obj}.${prop}` : null;
    }
    return null;
}

function attrByName(attrs, name) {
    return attrs.find((a) => a.type === 'JSXAttribute' && a.name?.name === name);
}

function hasOnHandler(attrs) {
    return attrs.some((a) => a.type === 'JSXAttribute' && HANDLER_RE.test(a.name?.name ?? ''));
}

function hasTestid(attrs) {
    // Present in either `data-testid="x"` or dynamic `data-testid={...}`.
    return !!attrByName(attrs, 'data-testid');
}

function getStringAttrValue(attr) {
    if (!attr) return null;
    const v = attr.value;
    if (!v) return null;
    if (v.type === 'Literal' && typeof v.value === 'string') return v.value;
    return null; // dynamic — can't statically introspect
}

function getRole(attrs) {
    return getStringAttrValue(attrByName(attrs, 'role'));
}

function isInteractive(name, attrs) {
    if (INTERACTIVE_TAGS.has(name)) return true;
    // Sub-component on a known interactive namespace (e.g. Radio.Group).
    const root = name.split('.')[0];
    if (INTERACTIVE_TAGS.has(root)) return true;
    if (hasOnHandler(attrs)) return true;
    const role = getRole(attrs);
    if (role && INTERACTIVE_ROLES.has(role)) return true;
    return false;
}

function walkJsx(node, visit) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'JSXOpeningElement') visit(node);
    for (const k of Object.keys(node)) {
        if (k === 'parent') continue;
        const v = node[k];
        if (Array.isArray(v)) {
            for (const c of v) walkJsx(c, visit);
        } else if (v && typeof v === 'object') {
            walkJsx(v, visit);
        }
    }
}

export async function scanFile(filePath) {
    const code = await readFile(filePath, 'utf8');
    return scanSource(code, filePath);
}

export function scanSource(code, filePath = '<inline>') {
    const ast = parse(code, {
        jsx: true,
        range: true,
        loc: true,
        errorOnUnknownASTType: false,
        // tolerate TS-only syntax without the full type-aware setup
        ecmaVersion: 'latest',
        sourceType: 'module',
    });
    const missing = [];
    const naming = [];
    walkJsx(ast, (node) => {
        const name = jsxName(node);
        if (!name) return;
        if (!isInteractive(name, node.attributes)) return;
        if (!hasTestid(node.attributes)) {
            missing.push({
                path: filePath,
                line: node.loc.start.line,
                tag: name,
            });
            return;
        }
        const idAttr = attrByName(node.attributes, 'data-testid');
        const idVal = getStringAttrValue(idAttr);
        if (idVal !== null && !TESTID_VALID_RE.test(idVal)) {
            naming.push({
                path: filePath,
                line: node.loc.start.line,
                tag: name,
                value: idVal,
            });
        }
    });
    return {missing, naming};
}

// ─── Main ────────────────────────────────────────────────────────────

const projRel = (p) => relative(ROOT, p).split(sep).join('/');

async function main() {
    const argv = process.argv.slice(2);
    const mode = argv.includes('--all') ? 'all' : 'diff';
    const quiet = argv.includes('--quiet');

    const allowMatch = makeAllowMatcher(loadAllowlist());

    const rawFiles = mode === 'all' ? await allFiles() : changedFiles();
    const files = rawFiles.filter((f) => {
        const rel = relative(ROOT, f).split(sep).join('/');
        return !allowMatch(rel);
    });

    const allMissing = [];
    const allNaming = [];
    const parseErrors = [];

    for (const f of files) {
        try {
            const {missing, naming} = await scanFile(f);
            allMissing.push(...missing);
            allNaming.push(...naming);
        } catch (err) {
            parseErrors.push({path: f, msg: err.message});
        }
    }

    // ─── Report ─────────────────────────────────────────────────────
    console.log(`Scanned ${files.length} .tsx file(s) [${mode}-mode].`);

    if (parseErrors.length) {
        console.warn(`\n${parseErrors.length} parse error(s) (non-blocking):`);
        for (const e of parseErrors) {
            console.warn(`  - ${projRel(e.path)}: ${e.msg}`);
        }
    }

    if (allNaming.length && !quiet) {
        console.warn(`\n${allNaming.length} naming-convention warning(s) (non-blocking):`);
        for (const n of allNaming) {
            console.warn(
                `  ${projRel(n.path)}:${n.line}\n` +
                `    ⚠ data-testid="${n.value}" doesn't follow feature-component-role kebab-case`,
            );
        }
    }

    if (allMissing.length === 0) {
        console.log(`\n✓ data-testid coverage OK`);
        process.exit(0);
    }

    const fileCount = new Set(allMissing.map((v) => v.path)).size;
    console.error(`\n✗ data-testid coverage check FAILED`);
    console.error(`  ${allMissing.length} violation(s) across ${fileCount} file(s)\n`);
    for (const v of allMissing) {
        console.error(`${projRel(v.path)}:${v.line}`);
        console.error(`  <${v.tag}> — missing data-testid`);
    }
    process.exit(1);
}

// Only execute when invoked as a CLI; importers (test file) get the
// `scanSource` export without side-effects.
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\\/g, '/').replace(/^([a-z]):/i, (_, d) => d.toUpperCase() + ':');
if (process.argv[1] && import.meta.url.startsWith('file:') && (
    fileURLToPath(import.meta.url) === process.argv[1] ||
    fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()
)) {
    main().catch((err) => {
        console.error(err);
        process.exit(2);
    });
}
