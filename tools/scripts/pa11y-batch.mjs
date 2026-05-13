#!/usr/bin/env node
/**
 * Pa11y batch — Wave 8a (WCAG 2.2 AA audit).
 *
 * Walks every URL in `.pa11yci.json` with `pa11y-ci` (the WCAG 2.2 AA
 * standard), aggregates per-route results, prints a human-readable summary,
 * and writes the full JSON report to `var/pa11y-report.json` for CI upload.
 *
 * Exit code:
 *   - 0 when no errors across any URL
 *   - 1 when any URL has at least one error-level violation
 *
 * CI integration: run `npm run pa11y` after `npm run build` and a started
 * server (`npm run start &`). The `pa11y` GHA job sets
 * `continue-on-error: true` initially so the baseline surfaces before we
 * flip it to a required check (per the spec — bed in, then gate).
 *
 * Local: same — `npm run build && npm run start &` then `npm run pa11y`.
 * Or against `npm run dev`: `BASE_URL=http://localhost:80 npm run pa11y`.
 *
 * `BASE_URL` env var overrides the `localhost:3000` prefix the .pa11yci.json
 * defaults to, so the same config works under different ports.
 */
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import pa11y from 'pa11y';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const CONFIG_PATH = resolve(REPO_ROOT, '.pa11yci.json');
const REPORT_PATH = resolve(REPO_ROOT, 'var', 'pa11y-report.json');

function loadConfig() {
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.urls || !Array.isArray(parsed.urls)) {
        throw new Error('.pa11yci.json must define `urls: []`');
    }
    return parsed;
}

function rewriteBase(url, baseUrl) {
    if (!baseUrl) return url;
    return url.replace(/^https?:\/\/localhost:\d+/, baseUrl);
}

async function runOne(url, defaults) {
    const t0 = Date.now();
    try {
        const result = await pa11y(url, {
            standard: defaults.standard ?? 'WCAG2AA',
            runners: defaults.runners ?? ['axe', 'htmlcs'],
            timeout: defaults.timeout ?? 60000,
            wait: defaults.wait ?? 800,
            ignore: defaults.ignore ?? [],
            chromeLaunchConfig: defaults.chromeLaunchConfig ?? {
                args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
            },
        });
        const errors = result.issues.filter(i => i.type === 'error');
        return {
            url,
            ms: Date.now() - t0,
            ok: errors.length === 0,
            errorCount: errors.length,
            issues: result.issues,
        };
    } catch (err) {
        return {
            url,
            ms: Date.now() - t0,
            ok: false,
            errorCount: -1,
            error: String(err?.message ?? err),
            issues: [],
        };
    }
}

function fmtRow(r) {
    const status = r.ok ? 'PASS' : r.errorCount === -1 ? 'CRASH' : 'FAIL';
    const count = r.errorCount === -1 ? '?' : String(r.errorCount);
    return `  ${status.padEnd(5)} ${count.padStart(3)} err  ${r.ms.toString().padStart(5)} ms  ${r.url}`;
}

async function main() {
    const cfg = loadConfig();
    const defaults = cfg.defaults ?? {};
    const baseUrl = process.env.BASE_URL ?? '';
    const urls = cfg.urls.map(u => rewriteBase(u, baseUrl));

    // eslint-disable-next-line no-console
    console.log(`[pa11y-batch] standard=${defaults.standard ?? 'WCAG2AA'} routes=${urls.length} baseUrl=${baseUrl || '(config default)'}`);
    const results = [];
    for (const url of urls) {
        // eslint-disable-next-line no-console
        console.log(`[pa11y-batch] auditing ${url}`);
        // Sequential — pa11y spawns Chromium per call and CI runners can't
        // sustain N parallel headless browsers without flaking.
        // eslint-disable-next-line no-await-in-loop
        const r = await runOne(url, defaults);
        results.push(r);
        // eslint-disable-next-line no-console
        console.log(fmtRow(r));
    }

    const totalErrors = results.reduce((a, r) => a + (r.errorCount > 0 ? r.errorCount : 0), 0);
    const failedRoutes = results.filter(r => !r.ok).length;
    const summary = {
        standard: defaults.standard ?? 'WCAG2AA',
        startedAt: new Date().toISOString(),
        routes: urls.length,
        failedRoutes,
        totalErrors,
        results,
    };

    mkdirSync(dirname(REPORT_PATH), {recursive: true});
    writeFileSync(REPORT_PATH, JSON.stringify(summary, null, 2));
    // eslint-disable-next-line no-console
    console.log(`[pa11y-batch] report → ${REPORT_PATH}`);
    // eslint-disable-next-line no-console
    console.log(`[pa11y-batch] ${failedRoutes}/${urls.length} routes failed, ${totalErrors} total errors`);

    process.exit(failedRoutes === 0 ? 0 : 1);
}

main().catch(err => {
    // eslint-disable-next-line no-console
    console.error('[pa11y-batch] fatal:', err);
    process.exit(1);
});
