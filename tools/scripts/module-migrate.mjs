#!/usr/bin/env node
/**
 * Migrate a section's module from one type to another by reading the
 * new module spec from a JSON file. Wraps `mcp:call -- module.update`
 * so we don't shell-escape nested JSON twice.
 *
 *   npm run module:migrate <sectionId> <at> <jsonFile>
 *
 * Examples:
 *   npm run module:migrate cv-sec-home-vitals 0 ./tmp/kvd-payload.json
 *
 * The JSON file shape:
 *   {
 *     "type": "KEY_VALUE_DOSSIER",
 *     "style": "editorial",
 *     "content": { "title": "Hero vitals", "items": [...] }
 *   }
 *
 * `content` is auto-stringified before forwarding to MCP (the dispatcher
 * expects content as a JSON string per the `module.update` schema).
 */
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const [sectionId, atStr, jsonFile] = process.argv.slice(2);
if (!sectionId || atStr === undefined || !jsonFile) {
    console.error('Usage: module-migrate <sectionId> <at> <jsonFile>');
    console.error('Example: module-migrate cv-sec-home-vitals 0 ./payload.json');
    process.exit(2);
}

const at = Number(atStr);
if (!Number.isInteger(at) || at < 0) {
    console.error(`<at> must be a non-negative integer; got "${atStr}"`);
    process.exit(2);
}

const absPath = path.isAbsolute(jsonFile) ? jsonFile : path.resolve(REPO_ROOT, jsonFile);
if (!existsSync(absPath)) {
    console.error(`No file at ${absPath}`);
    process.exit(2);
}

let spec;
try {
    spec = JSON.parse(readFileSync(absPath, 'utf8'));
} catch (err) {
    console.error('Invalid JSON in payload file:', err.message);
    process.exit(2);
}
if (!spec.type) {
    console.error('Payload missing required `type` field');
    process.exit(2);
}

// Content must be a JSON string when passed to MCP. The author may have
// provided it as an object — auto-stringify in that case.
const moduleSpec = {
    ...spec,
    content: typeof spec.content === 'string' ? spec.content : JSON.stringify(spec.content ?? {}),
};

const args = {sectionId, at, module: moduleSpec};
console.error(`[migrate] sectionId=${sectionId} at=${at} type=${spec.type} style=${spec.style ?? '(none)'}`);

// Invoke the mcp-call script directly with node — bypasses the npm
// shell wrapper that strips JSON quotes on Windows.
const MCP_CALL = path.join(REPO_ROOT, 'tools', 'scripts', 'mcp-call.mjs');
const child = spawn(
    process.execPath, [MCP_CALL, 'module.update', JSON.stringify(args)],
    {cwd: REPO_ROOT, stdio: 'inherit'},
);
child.on('exit', (code) => process.exit(code ?? 1));
