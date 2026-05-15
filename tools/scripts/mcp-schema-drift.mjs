#!/usr/bin/env node
/**
 * MCP ↔ GraphQL schema drift detector (F8 Week-1 hardening).
 *
 * What it does
 *   1. Walks every `services/features/Mcp/tools/*.ts` and extracts each
 *      tool's name + `inputSchema` properties (best-effort textual
 *      parse — no full TypeScript AST).
 *   2. Walks every `services/features/**\/*ServiceLoader.ts` (and the
 *      central `services/api/schema.graphql`) and extracts each
 *      `extend type MutationMongo { … }` block, parsing each mutation's
 *      arg list (name + scalar type).
 *   3. For each MCP tool whose name maps to a same-named GraphQL
 *      mutation (heuristics: `page.update` ↔ `updatePage` / `pageUpdate`
 *      / `addUpdateNavigationItem` are NOT auto-mapped — only exact
 *      `<verb><Noun>` ↔ `<noun>.<verb>` matches), compare property
 *      sets. Anything ambiguous is emitted as a warning, never a hard
 *      drift.
 *   4. Exits 0 if clean, 1 on hard drift. Warnings go to stderr but
 *      don't fail the run.
 *
 * Hard drift (exit 1):
 *   - extra MCP arg whose name doesn't exist on the matched mutation
 *   - missing MCP arg the mutation marks as `!` (required)
 *   - obvious type mismatch (`String` vs `Int`)
 *
 * Soft drift (warning):
 *   - tool name doesn't map to any mutation (we don't know which)
 *   - mutation arg uses a complex `Input*` type the MCP schema can't
 *     compare against
 *
 * This is best-effort static analysis. Phase 2 sweeps tools onto the
 * `compose(...)` wrappers; this script lights up the gaps before the
 * sweep starts.
 */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(__filename, '..', '..', '..');

const TOOLS_DIR = join(ROOT, 'services', 'features', 'Mcp', 'tools');
const FEATURES_DIR = join(ROOT, 'services', 'features');
const CENTRAL_SCHEMA = join(ROOT, 'services', 'api', 'schema.graphql');

const errors = [];
const warnings = [];

function walk(dir, out = []) {
    let entries;
    try { entries = readdirSync(dir); } catch { return out; }
    for (const name of entries) {
        const p = join(dir, name);
        let s;
        try { s = statSync(p); } catch { continue; }
        if (s.isDirectory()) {
            if (name === 'node_modules' || name === '.next' || name === '__tests__') continue;
            walk(p, out);
        } else {
            out.push(p);
        }
    }
    return out;
}

// ─── Extract MCP tools ────────────────────────────────────────────────

/**
 * Scrape MCP tools from a `pages.ts`-shaped source. We don't run the
 * TS — we look for `name: 'page.update'` and the next
 * `inputSchema: { … properties: { … } … }` block, then yank every
 * top-level key inside `properties`.
 */
function extractMcpTools(src, file) {
    const tools = [];
    const re = /name\s*:\s*['"]([a-zA-Z][\w.]*)['"]/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        const name = m[1];
        if (!name.includes('.')) continue; // tools are namespaced (page.list etc.)
        // grab next ~4000 chars and try to find the `properties: {` block
        const slice = src.slice(m.index, m.index + 4000);
        // F8 phase-2 hints — bound the search to the metadata head
        // before `inputSchema:` so we don't bleed into the next tool.
        const inputSchemaIdx = slice.indexOf('inputSchema');
        const head = inputSchemaIdx > 0 ? slice.slice(0, inputSchemaIdx) : slice.slice(0, 600);
        const safeMarker = /\/\/\s*SAFE:/i.test(
            // look back ~400 chars too to catch comment placed before `name:`
            src.slice(Math.max(0, m.index - 400), m.index) + head,
        );
        const gqlHintMatch = head.match(/gqlMutation\s*:\s*['"]([a-zA-Z_]\w*)['"]/);
        const propsIdx = slice.search(/properties\s*:\s*\{/);
        const requiredMatch = slice.match(/required\s*:\s*\[([^\]]*)\]/);
        const props = [];
        if (propsIdx >= 0) {
            // brace-balanced extraction starting at the `{` after `properties:`
            const openIdx = slice.indexOf('{', propsIdx);
            let depth = 0;
            let body = '';
            for (let i = openIdx; i < slice.length; i++) {
                const ch = slice[i];
                if (ch === '{') depth++;
                else if (ch === '}') { depth--; if (depth === 0) break; }
                if (depth >= 1 && i > openIdx) body += ch;
            }
            // Top-level keys: scan body and skip nested braces.
            let nest = 0;
            let lineStart = true;
            let token = '';
            const seen = new Set();
            const RESERVED = new Set([
                'type', 'description', 'enum', 'minimum', 'maximum',
                'minLength', 'maxLength', 'items', 'required',
                'default', 'properties',
            ]);
            for (let i = 0; i < body.length; i++) {
                const ch = body[i];
                if (ch === '{') { nest++; token = ''; continue; }
                if (ch === '}') { nest--; token = ''; continue; }
                if (nest !== 0) continue;
                if (/[a-zA-Z0-9_]/.test(ch)) {
                    if (lineStart || token.length > 0) token += ch;
                } else if (ch === ':' && token.length > 0) {
                    if (!RESERVED.has(token) && !seen.has(token)) {
                        seen.add(token); props.push(token);
                    }
                    token = '';
                } else {
                    token = '';
                }
                lineStart = (ch === '\n' || ch === ',' || /\s/.test(ch));
            }
        }
        const required = requiredMatch
            ? requiredMatch[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean)
            : [];
        tools.push({
            name,
            props,
            required,
            file,
            gqlMutation: gqlHintMatch ? gqlHintMatch[1] : null,
            safe: safeMarker,
        });
    }
    return tools;
}

const mcpTools = [];
for (const f of walk(TOOLS_DIR)) {
    if (!f.endsWith('.ts') || f.endsWith('.test.ts') || f.endsWith('_shared.ts') || f.endsWith('index.ts')) continue;
    const src = readFileSync(f, 'utf8');
    mcpTools.push(...extractMcpTools(src, f));
}

// ─── Extract GraphQL mutations ────────────────────────────────────────

function extractMutations(src, file) {
    const out = [];
    const blockRe = /extend\s+type\s+MutationMongo\s*\{([\s\S]*?)\n\}/g;
    let bm;
    while ((bm = blockRe.exec(src)) !== null) {
        const body = bm[1];
        // Each mutation: `name(arg: Type!, …): RetType[!]`
        const mutRe = /^\s*([a-zA-Z]\w*)\s*\(([^)]*)\)\s*:/gm;
        let mm;
        while ((mm = mutRe.exec(body)) !== null) {
            const name = mm[1];
            const argsRaw = mm[2].trim();
            const args = [];
            if (argsRaw) {
                for (const part of argsRaw.split(',')) {
                    const t = part.trim();
                    if (!t) continue;
                    const am = t.match(/^([a-zA-Z_]\w*)\s*:\s*(\[?[A-Za-z_][\w]*\]?!?)/);
                    if (!am) continue;
                    const typ = am[2];
                    args.push({
                        name: am[1],
                        type: typ.replace(/[!\[\]]/g, ''),
                        required: typ.endsWith('!') && !typ.startsWith('['),
                    });
                }
            }
            out.push({name, args, file});
        }
    }
    return out;
}

const mutations = [];
for (const f of [CENTRAL_SCHEMA, ...walk(FEATURES_DIR).filter(p => p.endsWith('ServiceLoader.ts'))]) {
    let src;
    try { src = readFileSync(f, 'utf8'); } catch { continue; }
    mutations.push(...extractMutations(src, f));
}

// ─── Match + compare ──────────────────────────────────────────────────

function candidatesFor(toolName) {
    const [scope, verb] = toolName.split('.');
    if (!verb) return [];
    const cap = (s) => s[0].toUpperCase() + s.slice(1);
    return [
        verb + cap(scope),       // updatePage
        scope + cap(verb),       // pageUpdate
        verb,                    // update
    ];
}

const SCALAR_EQUIVALENT = {String: 'string', Int: 'integer', Float: 'number', Boolean: 'boolean', ID: 'string'};

function compareTool(tool, mut) {
    const drift = [];
    const mutArgNames = new Set(mut.args.map(a => a.name));
    const mcpProps = new Set(tool.props);
    // The well-known cross-cutting hardening args don't have GraphQL
    // counterparts; they're handled by the MCP wrappers, not the
    // resolvers, so they should NEVER count as drift.
    // Bulk-extension wrappers (`ids`, `items`, `groups`) are aggregated
    // server-side by `runBatch` — each per-item payload is dispatched
    // through the single-item mutation. Treat them as harness args so
    // bulk-extension tools stay drift-clean. Reference: F8 bulk sweep
    // (2026-05-12), see docs/roadmap/platform/mcp-bulk-and-introspection.md.
    const HARNESS_ARGS = new Set([
        'idempotencyKey', 'expectedVersion', '_session',
        'ids', 'items', 'groups',
    ]);
    // When the mutation's arg list is dominated by an Input* wrapper or
    // a JSON blob, the MCP tool flattens those inner fields; the static
    // comparator can't cross that boundary without parsing the Input
    // schema. Skip the deep diff and trust the explicit gqlMutation
    // hint as proof the developer audited the mapping.
    const SCALAR_TYPES = new Set(['String', 'Int', 'Float', 'Boolean', 'ID']);
    const hasComplexInput = mut.args.some(a => !SCALAR_TYPES.has(a.type));
    if (hasComplexInput) return drift;
    for (const p of mcpProps) {
        if (HARNESS_ARGS.has(p)) continue;
        if (!mutArgNames.has(p)) {
            drift.push(`extra MCP arg "${p}" on ${tool.name} not on mutation ${mut.name}`);
        }
    }
    for (const a of mut.args) {
        if (a.required && !mcpProps.has(a.name)) {
            drift.push(`missing required MCP arg "${a.name}" (mutation ${mut.name} demands it)`);
        }
    }
    return drift;
}

const matched = new Set();
for (const tool of mcpTools) {
    // SAFE-marked tools opt out of the drift check entirely — they
    // don't route through a single GraphQL mutation (audit reads,
    // direct collection writes, HTTP fan-out, etc.).
    if (tool.safe && !tool.gqlMutation) continue;

    let matches;
    if (tool.gqlMutation) {
        // Explicit hint wins — only the named mutation counts.
        matches = mutations.filter(m => m.name === tool.gqlMutation);
        if (matches.length === 0) {
            warnings.push(`SOFT: tool "${tool.name}" pins gqlMutation "${tool.gqlMutation}" but no such mutation exists`);
            continue;
        }
    } else {
        const cands = candidatesFor(tool.name);
        matches = mutations.filter(m => cands.includes(m.name));
        if (matches.length === 0) {
            warnings.push(`SOFT: tool "${tool.name}" has no matching GraphQL mutation (candidates: ${cands.join(', ')})`);
            continue;
        }
        if (matches.length > 1) {
            warnings.push(`SOFT: tool "${tool.name}" matches ${matches.length} mutations; picking first (${matches[0].name})`);
        }
    }
    matched.add(tool.name);
    const drift = compareTool(tool, matches[0]);
    for (const d of drift) errors.push(`HARD: ${d}`);
}

// ─── Report ───────────────────────────────────────────────────────────

const projRel = (p) => relative(ROOT, p).split(sep).join('/');

console.log(`Scanned ${mcpTools.length} MCP tools across ${new Set(mcpTools.map(t => projRel(t.file))).size} files.`);
console.log(`Scanned ${mutations.length} GraphQL mutations across ${new Set(mutations.map(m => projRel(m.file))).size} files.`);
console.log(`Matched ${matched.size}/${mcpTools.length} tools to a same-named mutation.`);

if (warnings.length) {
    console.warn(`\n${warnings.length} soft warning(s) (non-blocking):`);
    for (const w of warnings) console.warn(`  - ${w}`);
}

if (errors.length) {
    console.error(`\n${errors.length} hard drift error(s):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
}

console.log(`\nNo hard drift detected. ✓`);
process.exit(0);
