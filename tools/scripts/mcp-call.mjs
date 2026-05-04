#!/usr/bin/env node
/**
 * Drive any MCP tool against the local dev instance.
 *
 *   npm run mcp:call -- <toolName> [argsJson]
 *
 * Examples:
 *   # List every registered tool, mode-filtered
 *   npm run mcp:call -- tool.list
 *
 *   # Add the InquiryForm module to skyclimber's Kontakti page
 *   npm run mcp:call -- module.add '{"sectionId":"sc7-sec-contact","module":{"type":"INQUIRY_FORM","content":"{\"title\":\"Sazinies ar mums\"}"}}'
 *
 *   # Restore the most recent trash group
 *   npm run mcp:call -- trash.list
 *   npm run mcp:call -- trash.restore '{"trashGroup":"<id>"}'
 *
 * Resolves the dev token via tools/mcp.dev.json (run `npm run mcp:dev-token`
 * if the file is missing). Same DB-backed credential as Claude Code / Cursor
 * would use — no bypass.
 *
 * Connects to the LIVE Mongo (whatever MONGODB_URI points at) and dispatches
 * through `McpServer.dispatch()` IN-PROCESS. Identical code path the running
 * dev server uses for an inbound MCP request: scope check, idempotency
 * wrapper, audit, rate-limit, error envelope. Calls show up in the admin
 * audit log and respect mode + role gating.
 *
 * Exits non-zero on `{ok:false}`. The dispatch envelope is printed as JSON
 * to stdout for piping (`| jq`).
 */
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

async function main() {
    const [toolName, argsJson = '{}'] = process.argv.slice(2);
    if (!toolName) {
        console.error('Usage: mcp-call <toolName> [argsJson]');
        process.exit(2);
    }

    let args;
    try {
        args = JSON.parse(argsJson);
    } catch (err) {
        console.error('Invalid argsJson:', err.message);
        process.exit(2);
    }

    // Read dev token from tools/mcp.dev.json. Falls back to a stub token
    // (same id, broad scopes) if the file is absent — useful for one-shot
    // local calls without a Mongo round-trip. The audit row will show the
    // stub identity.
    let token;
    try {
        const cfg = JSON.parse(readFileSync(path.join(REPO_ROOT, 'tools', 'mcp.dev.json'), 'utf8'));
        const entry = cfg?.mcpServers && Object.values(cfg.mcpServers)[0];
        const secret = entry?.env?.MCP_TOKEN || cfg?.token || cfg?.secret;
        token = {
            id: cfg?.id || 'dev-token',
            name: cfg?.name || 'mcp-call.mjs',
            scopes: cfg?.scopes || [
                'read:content', 'write:content',
                'read:i18n', 'write:i18n',
                'read:themes', 'write:themes',
                'read:products', 'write:products',
                'read:inventory', 'write:inventory',
                'read:site', 'write:site',
                'read:audit',
                'admin:auth',
            ],
            tokenSecret: secret,
        };
    } catch {
        console.error('[mcp-call] no tools/mcp.dev.json — using broad-scope stub');
        token = {
            id: 'dev-stub',
            name: 'mcp-call.mjs',
            scopes: ['read:content', 'write:content', 'read:i18n', 'write:i18n',
                     'read:themes', 'write:themes', 'read:products', 'write:products',
                     'read:inventory', 'write:inventory', 'read:site', 'write:site',
                     'read:audit', 'admin:auth'],
        };
    }

    // tsx is the simplest way to import TypeScript modules from a script;
    // the existing tools/scripts/cleanup-ghost-navigation.ts uses the same
    // pattern. Spawn tsx in a child to load the actual handler.
    const {spawn} = await import('node:child_process');
    const child = spawn(
        'npx',
        [
            'tsx',
            '--tsconfig', 'services/tsconfig.custom.json',
            path.join(__dirname, 'mcp-call-runner.ts'),
        ],
        {
            cwd: REPO_ROOT,
            stdio: ['pipe', 'inherit', 'inherit'],
            // Windows requires shell:true so the .cmd shim resolves; harmless on POSIX.
            shell: process.platform === 'win32',
            env: {...process.env, MCP_CALL_TOOL: toolName, MCP_CALL_ARGS: JSON.stringify(args), MCP_CALL_TOKEN: JSON.stringify(token)},
        },
    );
    child.stdin.end();
    await new Promise((resolve, reject) => {
        child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`exited ${code}`)));
        child.on('error', reject);
    });
}

main().catch(err => { console.error(err); process.exit(1); });
