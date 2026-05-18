/**
 * MCP tools — module + surface visual baselines.
 *
 * Exposes the Playwright visual-regression snapshots
 * (`tests/e2e/visual/modules/{displays,editors}.spec.ts-snapshots/*.png`
 *  + `tests/e2e/visual/surfaces.spec.ts-snapshots/*.png`) over MCP so
 * that AI authoring sessions can:
 *
 *  1. **Step 0 (Audit)** — see what each existing module looks like
 *     before deciding whether to design a new one
 *  2. **Step 1 (Capture)** — pull the current baseline as `before.png`
 *     into a Stitch artefacts folder, without re-running playwright
 *  3. **Step 4 (Implement)** — eyeball a new module's screenshot
 *     against similar existing ones
 *
 * These tools bypass the `defineTool`/`compose` envelope helper because
 * they return image content blocks (per MCP spec), not JSON. Both are
 * read-only — no idempotency, no rate-limit wrapping needed.
 */
import {promises as fs} from 'fs';
import path from 'path';
import {McpTool, McpToolResult} from '../types';

/** Repo-root-relative dirs. The handlers `path.resolve` from cwd at call
 *  time so they work regardless of where the server boots. */
const DISPLAYS_DIR = 'tests/e2e/visual/modules/displays.spec.ts-snapshots';
const EDITORS_DIR = 'tests/e2e/visual/modules/editors.spec.ts-snapshots';
const SURFACES_DIR = 'tests/e2e/visual/surfaces.spec.ts-snapshots';

/** Strip the Playwright filename convention down to the slug a caller
 *  passes — `display-key-value-dossier-visual-win32.png` → `key-value-dossier`. */
function nameOf(filename: string, prefix: 'display' | 'editor' | 'surface' | 'component'): string {
    return filename
        .replace(/^display-/, '')
        .replace(/^editor-/, '')
        .replace(/^surface-/, '')
        .replace(/^component-/, '')
        .replace(/-visual-(win32|darwin|linux)\.png$/, '');
}

function fileFor(kind: 'display' | 'editor' | 'surface' | 'component', name: string): {dir: string; file: string} {
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (kind === 'display') return {dir: DISPLAYS_DIR, file: `display-${slug}-visual-win32.png`};
    if (kind === 'editor')  return {dir: EDITORS_DIR,  file: `editor-${slug}-visual-win32.png`};
    if (kind === 'surface') return {dir: SURFACES_DIR, file: `surface-${slug}-visual-win32.png`};
    return {dir: SURFACES_DIR, file: `component-${slug}-visual-win32.png`};
}

async function listDir(dir: string): Promise<string[]> {
    try {
        return (await fs.readdir(path.resolve(dir))).filter(f => f.endsWith('.png')).sort();
    } catch { return []; }
}

/** Read a PNG and return it as an MCP image content block. */
async function readImage(absPath: string): Promise<McpToolResult> {
    const bytes = await fs.readFile(absPath);
    return {
        content: [{
            type: 'image',
            data: bytes.toString('base64'),
            mimeType: 'image/png',
        }],
    };
}

function textResult(payload: unknown): McpToolResult {
    return {content: [{type: 'text', text: JSON.stringify({ok: true, data: payload})}]};
}

function errorResult(code: string, message: string): McpToolResult {
    return {content: [{type: 'text', text: JSON.stringify({ok: false, error: {code, message}})}]};
}

/** module.screenshot.list — inventory of every baseline currently on disk. */
export const moduleScreenshotList: McpTool = {
    name: 'module.screenshot.list',
    description:
        'Lists every visual baseline PNG. Returns entries grouped by kind ' +
        '(display / editor / surface / component) with the slug callers pass ' +
        'to module.screenshot.get. Use during the Stitch pipeline Step 0 (Audit) ' +
        'to see what modules already exist visually.',
    scopes: ['read:audit'],
    inputSchema: {
        type: 'object',
        properties: {
            kind: {type: 'string', enum: ['display', 'editor', 'surface', 'component', 'all']},
            filter: {type: 'string', description: 'Optional substring filter on slug, case-insensitive.'},
        },
    },
    handler: async (args, _ctx) => {
        const kind = (args?.kind ?? 'all') as string;
        const filter = ((args?.filter ?? '') as string).toLowerCase();
        const match = (slug: string) => !filter || slug.toLowerCase().includes(filter);

        const groups: Record<string, string[]> = {};

        if (kind === 'display' || kind === 'all') {
            groups.display = (await listDir(DISPLAYS_DIR)).map(f => nameOf(f, 'display')).filter(match);
        }
        if (kind === 'editor' || kind === 'all') {
            groups.editor = (await listDir(EDITORS_DIR)).map(f => nameOf(f, 'editor')).filter(match);
        }
        if (kind === 'surface' || kind === 'all') {
            const all = await listDir(SURFACES_DIR);
            groups.surface = all.filter(f => f.startsWith('surface-')).map(f => nameOf(f, 'surface')).filter(match);
            groups.component = all.filter(f => f.startsWith('component-')).map(f => nameOf(f, 'component')).filter(match);
        }

        const counts = Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length]));
        return textResult({counts, items: groups});
    },
};

/** module.screenshot.get — fetch one baseline PNG as an inline image block. */
export const moduleScreenshotGet: McpTool = {
    name: 'module.screenshot.get',
    description:
        'Returns a single visual baseline PNG as an inline image content block. ' +
        'Pass `kind` (display/editor/surface/component) and the slug shown by ' +
        'module.screenshot.list. Example: kind="display" name="hero" returns ' +
        'display-hero-visual-win32.png. Used during the Stitch pipeline ' +
        'Step 0 (Audit) + Step 1 (Capture) so an AI session can see the ' +
        "current baseline without bouncing through the filesystem.",
    scopes: ['read:audit'],
    inputSchema: {
        type: 'object',
        required: ['kind', 'name'],
        properties: {
            kind: {type: 'string', enum: ['display', 'editor', 'surface', 'component']},
            name: {type: 'string', minLength: 1, description: 'Slug as printed by module.screenshot.list (e.g. "hero", "key-value-dossier").'},
        },
    },
    handler: async (args, _ctx) => {
        const {dir, file} = fileFor(args.kind, args.name);
        const abs = path.resolve(dir, file);
        try {
            await fs.access(abs);
        } catch {
            return errorResult('NOT_FOUND', `No baseline at ${dir}/${file}. List available with module.screenshot.list.`);
        }
        return readImage(abs);
    },
};

export const MODULE_SCREENSHOT_TOOLS: McpTool[] = [
    moduleScreenshotList,
    moduleScreenshotGet,
];
