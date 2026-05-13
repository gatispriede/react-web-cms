/**
 * Accessibility MCP tools — Wave 8a.
 *
 * `a11y.audit { route }` — fetches a route via a headless browser, injects
 * `axe-core`, runs the WCAG 2.2 AA suite, and returns the violations array.
 *
 * Headless driver:
 *   - prefers `playwright` (already a devDep via `@playwright/test`)
 *   - lazy `require()` so the production runtime doesn't pay the import
 *     cost when nobody calls this tool, and gracefully degrades when
 *     playwright isn't installed (e.g. minimal prod image) — the tool
 *     returns `{ok: false, reason: 'playwright-unavailable'}` rather
 *     than crashing.
 *
 * Scope: read-only audit; no DB writes. No idempotency wrapper needed.
 *
 * Out of scope for this jump:
 *   - per-theme runs (axe results vary by theme; spec says manual ops
 *     iterate via the dev panel or `pa11y-batch` instead)
 *   - screen-reader passes (manual wall-clock work — spec explicitly defers)
 */
import {defineTool} from './_shared';
import {McpTool} from '../types';
import {log} from '@services/infra/logger';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

interface AxeRunOutput {
    violations: Array<{
        id: string;
        impact?: string | null;
        description?: string;
        help?: string;
        helpUrl?: string;
        nodes?: Array<{target?: string[]; html?: string}>;
    }>;
}

async function loadPlaywright(): Promise<{chromium: any} | null> {
    try {
         
        const mod = await import('playwright');
        return {chromium: (mod as any).chromium};
    } catch {
        // playwright not installed — surface a clean reason rather than a
        // raw MODULE_NOT_FOUND. The audit tool downgrades gracefully.
        return null;
    }
}

async function loadAxeSource(): Promise<string | null> {
    try {
        // axe-core's package exposes a bundle file with the IIFE we can
        // inject into the page. We read the path off the package.json
        // `source` field for stability across major versions.
         
        const axePkg = await import('axe-core');
        return (axePkg as any).source ?? (axePkg as any).default?.source ?? null;
    } catch {
        return null;
    }
}

export const a11yAudit: McpTool = defineTool({
    // SAFE: not a GraphQL mutation
    name: 'a11y.audit',
    description: 'Run axe-core (WCAG 2.2 AA) against a public route. Returns the violations array. Requires playwright + axe-core at runtime; gracefully degrades when unavailable.',
    scopes: ['read:audit'],
    inputSchema: {
        type: 'object',
        required: ['route'],
        properties: {
            route: {type: 'string', minLength: 1, description: 'Absolute URL or path (rooted at /).'},
            baseUrl: {type: 'string', description: 'Optional base URL prefix (default: http://localhost:3000).'},
            waitMs: {type: 'integer', minimum: 0, maximum: 30000, description: 'Additional dwell time before running axe (default 800ms).'},
        },
    },
}, async (args) => {
    const baseUrl: string = typeof args.baseUrl === 'string' ? args.baseUrl : 'http://localhost:3000';
    const route: string = String(args.route);
    const waitMs: number = typeof args.waitMs === 'number' ? args.waitMs : 800;
    const url = /^https?:\/\//.test(route) ? route : `${baseUrl.replace(/\/$/, '')}${route.startsWith('/') ? '' : '/'}${route}`;

    const pw = await loadPlaywright();
    if (!pw) {
        return {
            ok: false,
            url,
            reason: 'playwright-unavailable',
            hint: 'Install `playwright` (or run from a devDeps-included image) to enable a11y.audit.',
        };
    }
    const axeSource = await loadAxeSource();
    if (!axeSource) {
        return {ok: false, url, reason: 'axe-core-unavailable'};
    }

    const browser = await pw.chromium.launch({
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    try {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.goto(url, {waitUntil: 'networkidle', timeout: 45_000});
        if (waitMs > 0) await page.waitForTimeout(waitMs);
        await page.addScriptTag({content: axeSource});
        const out: AxeRunOutput = await page.evaluate(async (tags: string[]) => {
            // axe is now on `window.axe` after the script tag injection.
             
            const axe = (globalThis as any).axe;
            return axe.run(document, {runOnly: {type: 'tag', values: tags}});
        }, AXE_TAGS);
        return {
            ok: true,
            url,
            violationCount: out.violations.length,
            violations: out.violations.map(v => ({
                id: v.id,
                impact: v.impact ?? null,
                help: v.help,
                helpUrl: v.helpUrl,
                description: v.description,
                nodeCount: v.nodes?.length ?? 0,
            })),
        };
    } catch (err) {
        log.warn({scope: 'mcp.a11yAudit', url, err: String((err as Error)?.message ?? err)}, 'a11y.audit failed');
        return {ok: false, url, reason: 'audit-failed', error: String((err as Error)?.message ?? err)};
    } finally {
        await browser.close();
    }
});

export const A11Y_TOOLS: McpTool[] = [a11yAudit];
