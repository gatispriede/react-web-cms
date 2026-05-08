#!/usr/bin/env node
/**
 * Issue a development MCP token + write the example client config.
 *
 * One-shot bootstrap for hooking Claude Code / Cursor / any other MCP
 * client into the LOCAL CMS. The token is a real DB-backed credential
 * — same code path as the admin "Issue token" button, same audit trail,
 * same revocation path. NOT a bypass; just a CLI shortcut.
 *
 * Output
 *   - prints the secret ONCE to stdout (you'll never see it again,
 *     same as the admin reveal dialog)
 *   - writes `tools/mcp.dev.json` with the secret already inlined,
 *     ready to copy into `~/.config/claude-code/mcp.json` or the
 *     Cursor / Codex equivalent. The file is gitignored.
 *
 * Re-running rotates: a fresh token is issued, the previous one stays
 * in the DB until you revoke it via /admin/system/mcp.
 *
 * Defaults
 *   - All scopes — including `admin:auth` so the agent can call
 *     `/api/auth/reset-lockout`. If you want to scope it down, edit
 *     the SCOPES array below.
 *   - 365-day TTL — long enough that you don't think about it during
 *     development; short enough it'll eventually nag a rotation.
 *   - Connects to MONGODB_URI (env), defaulting to the standard local
 *     mongo dev URL.
 */
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(REPO_ROOT, 'tools', 'mcp.dev.json');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
// Edit if you want a less powerful dev token.
const SCOPES = [
    'read:content', 'write:content',
    'read:i18n', 'write:i18n',
    'read:themes', 'write:themes',
    'read:products', 'write:products',
    'read:inventory', 'write:inventory',
    'read:site', 'write:site',
    'read:audit',
    'admin:auth',
    // mcp-rollout-aftermath #5 — bundle.export + bundle.import need
    // admin:bundle. Local dev tokens are deliberately maximally
    // privileged (Mongo is throwaway); production tokens stay
    // least-privilege via the admin UI.
    'admin:bundle',
];
const NAME = process.env.MCP_DEV_TOKEN_NAME || `dev-${require('node:os').hostname()}`;

async function main() {
    process.stdout.write(`[mcp-dev-token] connecting to ${MONGODB_URI}…\n`);

    // Use tsx to load the TypeScript service modules at runtime so the
    // script works on a fresh checkout without a build step. Spawn the
    // actual issue inside a tsx subprocess and capture the result.
    const {spawnSync} = require('node:child_process');
    const tsxBin = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const innerScript = `
        import {MongoClient} from 'mongodb';
        import {McpTokenService} from '@services/features/Mcp/McpTokenService';
        const uri = ${JSON.stringify(MONGODB_URI)};
        const name = ${JSON.stringify(NAME)};
        const scopes = ${JSON.stringify(SCOPES)};
        (async () => {
            const client = await MongoClient.connect(uri);
            try {
                const db = client.db('DB');
                const svc = new McpTokenService(db);
                const issued = await svc.issueToken({name, scopes, ttlDays: 365}, 'tools/mcp-dev-token.js');
                process.stdout.write(JSON.stringify(issued) + '\\n');
            } finally {
                await client.close();
            }
        })().catch(err => {
            process.stderr.write('inner failed: ' + err.message + '\\n');
            process.exit(1);
        });
    `;

    // tsx silently swallows stdout when combining `--tsconfig` with `-e`,
    // so write the inner script to a temp file and run that instead.
    // Must live inside the repo so node can resolve the workspace's node_modules.
    const tmpScript = path.join(REPO_ROOT, 'tools', `.mcp-dev-token-inner-${process.pid}.mts`);
    fs.writeFileSync(tmpScript, innerScript);
    let result;
    try {
        result = spawnSync(
            process.execPath,
            [tsxBin, '--tsconfig', 'services/tsconfig.custom.json', tmpScript],
            {cwd: REPO_ROOT, encoding: 'utf8', env: {...process.env, MONGODB_URI}},
        );
    } finally {
        try { fs.unlinkSync(tmpScript); } catch {}
    }

    if (result.status !== 0) {
        process.stderr.write(result.stderr || 'token issue failed\n');
        process.exit(result.status || 1);
    }

    const lines = (result.stdout || '').trim().split('\n');
    const issued = JSON.parse(lines[lines.length - 1]);

    // Write the client-config-shaped JSON next to the existing example.
    const config = {
        mcpServers: {
            'redis-cms-dev': {
                command: 'npx',
                args: ['tsx', '--tsconfig', 'services/tsconfig.custom.json', 'services/mcp/stdio.ts'],
                cwd: REPO_ROOT,
                env: {
                    MCP_TOKEN: issued.secret,
                    MONGODB_URI,
                },
            },
        },
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify(config, null, 2) + '\n');

    process.stdout.write('\n');
    process.stdout.write('========== MCP dev token issued ==========\n');
    process.stdout.write(`name:       ${issued.name}\n`);
    process.stdout.write(`id:         ${issued.id}\n`);
    process.stdout.write(`scopes:     ${issued.scopes.join(', ')}\n`);
    process.stdout.write(`expires:    ${issued.expiresAt ?? 'never'}\n`);
    process.stdout.write(`secret:     ${issued.secret}\n`);
    process.stdout.write(`config out: ${path.relative(REPO_ROOT, OUT_PATH)}\n`);
    process.stdout.write('==========================================\n\n');
    process.stdout.write('Next: copy the contents of tools/mcp.dev.json into your AI client\n');
    process.stdout.write('  Claude Code: ~/.config/claude-code/mcp.json\n');
    process.stdout.write('  Cursor:       ~/.cursor/mcp.json\n');
    process.stdout.write('Revoke at any time: /admin/system/mcp\n');
}

main().catch(err => {
    process.stderr.write('[mcp-dev-token] fatal: ' + err.stack + '\n');
    process.exit(1);
});
