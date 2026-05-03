#!/usr/bin/env node
/**
 * Conditional gqty regen for the production build.
 *
 * Compares the mtime of `services/api/schema.graphql` (source of truth)
 * against the mtime of `services/api/generated/schema.generated.ts`
 * (codegen output). If the source is newer — or the output is missing —
 * runs `npm run generate-schema` to refresh the gqty client; otherwise
 * exits silently so the production build doesn't pay the ~30-60 s cost
 * on every CI run.
 *
 * Wired as `prebuild` step (see package.json) so `npm run build` always
 * sees fresh types when the schema actually changed.
 *
 * Trade-off: if a schema change lands without bumping `schema.graphql`'s
 * mtime (rare — hand-editing the generated file, time-travel git
 * checkouts), this can serve stale types. Force a refresh in that case
 * with `npm run generate-schema` or `touch services/api/schema.graphql`.
 */
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'services/api/schema.graphql');
const GENERATED = path.join(ROOT, 'services/api/generated/schema.generated.ts');

function mtime(p) {
    try { return fs.statSync(p).mtimeMs; }
    catch { return 0; }
}

function regen() {
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const result = spawnSync(npm, ['run', 'generate-schema'], {
        cwd: ROOT,
        stdio: 'inherit',
    });
    process.exit(result.status ?? 1);
}

const src = mtime(SOURCE);
const gen = mtime(GENERATED);

if (src === 0) {
    console.error(`[check-schema-stale] schema source not found at ${SOURCE}; skipping regen.`);
    process.exit(0);
}

if (gen === 0) {
    console.log('[check-schema-stale] generated client missing — running generate-schema.');
    regen();
}

if (src > gen) {
    console.log(`[check-schema-stale] schema.graphql is newer than generated client — running generate-schema.`);
    regen();
}

console.log('[check-schema-stale] gqty client is up to date — skipping regen.');
