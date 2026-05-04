#!/usr/bin/env node
/**
 * Reset an admin user's password directly in Mongo.
 *
 * Recovery shortcut for "I lost the admin password and there's no
 * artefact on disk." Hashes the new value with bcrypt (matches the
 * server's `_hashSaltRounds`) and stamps `mustChangePassword: true`
 * so the operator's nudged to rotate again on next login.
 *
 * Usage
 *   node tools/admin-reset-password.js [email] [newPassword]
 *   node tools/admin-reset-password.js admin@admin.com 'fresh-pw-here'
 *
 * Defaults
 *   - email: admin@admin.com
 *   - password: a generated 16-char ascii string, printed on stdout
 *   - MONGODB_URI: env, falling back to mongodb://localhost:27017
 *   - BCRYPT_ROUNDS: env, falling back to 10 (matches server default)
 *
 * Safety
 *   - Refuses if no user matches the supplied email.
 *   - Doesn't create users — use the admin UI / first-boot seed for that.
 */
const path = require('node:path');
const {randomBytes} = require('node:crypto');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
const REPO_ROOT = path.resolve(__dirname, '..');

function randomPassword() {
    // ~96 bits of entropy in ascii-printable form. Avoids visually
    // ambiguous chars (no 0/O, 1/l/I).
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = randomBytes(16);
    let out = '';
    for (let i = 0; i < buf.length; i++) out += chars[buf[i] % chars.length];
    return out;
}

async function main() {
    const email = (process.argv[2] || 'admin@admin.com').toLowerCase();
    const newPw = process.argv[3] || randomPassword();
    const generated = !process.argv[3];

    const {spawnSync} = require('node:child_process');
    const tsxBin = path.join(REPO_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    // Run inside tsx so we can use the same bcrypt + mongo bindings the
    // server uses, no separate compile step.
    const inner = `
        import {MongoClient} from 'mongodb';
        import {hash} from 'bcrypt';
        const uri = ${JSON.stringify(MONGODB_URI)};
        const email = ${JSON.stringify(email)};
        const newPw = ${JSON.stringify(newPw)};
        const rounds = ${ROUNDS};
        (async () => {
            const client = await MongoClient.connect(uri);
            try {
                const users = client.db('DB').collection('Users');
                const existing = await users.findOne({email});
                if (!existing) {
                    process.stderr.write('no user with email ' + email + ' — refusing to create\\n');
                    process.exit(1);
                }
                const passwordHash = await hash(newPw, rounds);
                await users.updateOne({id: existing.id}, {$set: {password: passwordHash, mustChangePassword: true}});
                process.stdout.write(JSON.stringify({email, id: existing.id}) + '\\n');
            } finally {
                await client.close();
            }
        })().catch(err => {
            process.stderr.write('inner failed: ' + (err.stack || err.message) + '\\n');
            process.exit(1);
        });
    `;

    const result = spawnSync(
        process.execPath,
        [tsxBin, '--tsconfig', 'services/tsconfig.custom.json', '-e', inner],
        {cwd: REPO_ROOT, encoding: 'utf8', env: {...process.env, MONGODB_URI}},
    );

    if (result.status !== 0) {
        process.stderr.write(result.stderr || 'reset failed\n');
        process.exit(result.status || 1);
    }

    process.stdout.write('\n========== Admin password reset ==========\n');
    process.stdout.write(`email:    ${email}\n`);
    process.stdout.write(`password: ${newPw}${generated ? '  (generated — copy it now)' : ''}\n`);
    process.stdout.write('mustChangePassword: true (you'll be nudged to rotate on next login)\n');
    process.stdout.write('==========================================\n');
}

main().catch(err => { process.stderr.write('fatal: ' + err.stack + '\n'); process.exit(1); });
