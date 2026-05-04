#!/usr/bin/env node
/**
 * MCP Token CLI — issue, list, and revoke MCP tokens from the command line.
 * Connects directly to MongoDB — no running CMS required.
 *
 * Usage:
 *   node scripts/mcp-token.js issue --name "local-llm" --scopes "read:content,write:content"
 *   node scripts/mcp-token.js issue --name "local-llm" --scopes "read:content,write:content" --ttl 365
 *   node scripts/mcp-token.js list
 *   node scripts/mcp-token.js revoke <id>
 *   node scripts/mcp-token.js save  --name "local-llm" --scopes "read:content,write:content"
 *     └─ like issue but also writes CMS_SECRET to .env in the AI project
 */

import { randomBytes }   from 'crypto';
import { createRequire } from 'module';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath }   from 'url';

const require = createRequire(import.meta.url);
const bcrypt  = require('bcrypt');
const { MongoClient } = require('mongodb');

// ── Config ────────────────────────────────────────────────────────────────────

const __dir         = dirname(fileURLToPath(import.meta.url));
const envPath       = resolve(__dir, '../.env.local');
const envFallback   = resolve(__dir, '../.env');
const aiEnvPath     = resolve(__dir, '../../Experiments/AI/.env');

function loadEnv() {
  const path = existsSync(envPath) ? envPath : envFallback;
  if (!existsSync(path)) return;
  readFileSync(path, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && !process.env[k.trim()]) process.env[k.trim()] = v.join('=').trim();
  });
}
loadEnv();

const MONGO_URI    = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const DB_NAME      = 'DB';
const COLLECTION   = 'McpTokens';
const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;
const DEFAULT_TTL   = Number(process.env.MCP_TOKEN_DEFAULT_TTL_DAYS) || 90;
const REMAINDER_BYTES = 28;

const VALID_SCOPES = new Set([
  'read:content', 'write:content',
  'read:i18n',    'write:i18n',
  'read:themes',  'write:themes',
  'read:products','write:products',
  'read:inventory','write:inventory',
  'read:site',    'write:site',
  'read:audit',   'read:analytics',
  'admin:auth',
]);

// ── Token generation ──────────────────────────────────────────────────────────

function guid() {
  return randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

async function generateToken(name, scopes, ttlDays) {
  const prefix    = randomBytes(4).toString('hex');          // 8 hex
  const remainder = randomBytes(REMAINDER_BYTES).toString('hex'); // 56 hex
  const secret    = `mcpsk_${prefix}${remainder}`;
  const hashed    = await bcrypt.hash(remainder, BCRYPT_ROUNDS);

  const now      = new Date();
  const ttl      = ttlDays ?? DEFAULT_TTL;
  const expiresAt = ttl ? new Date(now.getTime() + ttl * 86400000).toISOString() : undefined;

  const doc = {
    id:             guid(),
    name,
    tokenIdPrefix:  prefix,
    hashedSecret:   hashed,
    scopes,
    createdBy:      'cli',
    createdAt:      now.toISOString(),
    ...(expiresAt ? { expiresAt } : {}),
  };

  return { doc, secret, expiresAt };
}

// ── Commands ──────────────────────────────────────────────────────────────────

async function cmdIssue({ name, scopes, ttl, save }) {
  if (!name) return die('--name is required');

  const scopeList = scopes
    ? scopes.split(',').map(s => s.trim()).filter(s => VALID_SCOPES.has(s))
    : ['read:content', 'write:content'];

  if (!scopeList.length) return die(`No valid scopes. Valid: ${[...VALID_SCOPES].join(', ')}`);

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const col = client.db(DB_NAME).collection(COLLECTION);

    const { doc, secret, expiresAt } = await generateToken(name, scopeList, ttl ? Number(ttl) : undefined);
    await col.insertOne(doc);

    console.log('\n✓ Token issued\n');
    console.log(`  Name    : ${name}`);
    console.log(`  ID      : ${doc.id}`);
    console.log(`  Scopes  : ${scopeList.join(', ')}`);
    console.log(`  Expires : ${expiresAt ?? 'never'}`);
    console.log(`\n  Secret  : ${secret}\n`);
    console.log('  ⚠ Copy this now — it cannot be recovered.\n');

    if (save && existsSync(aiEnvPath)) {
      let env = readFileSync(aiEnvPath, 'utf8');
      if (env.match(/^CMS_SECRET=.*/m)) {
        env = env.replace(/^CMS_SECRET=.*/m, `CMS_SECRET=${secret}`);
      } else {
        env += `\nCMS_SECRET=${secret}\n`;
      }
      writeFileSync(aiEnvPath, env, 'utf8');
      console.log(`  ✓ Saved to ${aiEnvPath} as CMS_SECRET\n`);
    }

    return secret;
  } finally {
    await client.close();
  }
}

async function cmdList() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const col   = client.db(DB_NAME).collection(COLLECTION);
    const tokens = await col.find({}, {
      projection: { id: 1, name: 1, scopes: 1, createdBy: 1, createdAt: 1, expiresAt: 1, revokedAt: 1, lastUsedAt: 1 }
    }).toArray();

    if (!tokens.length) { console.log('\n  No tokens found.\n'); return; }

    console.log(`\n  ${tokens.length} token(s):\n`);
    tokens.forEach(t => {
      const status = t.revokedAt ? '✗ REVOKED' : (t.expiresAt && new Date(t.expiresAt) < new Date()) ? '⚠ EXPIRED' : '✓ active';
      console.log(`  [${status}] ${t.name}`);
      console.log(`    ID      : ${t.id}`);
      console.log(`    Scopes  : ${(t.scopes ?? []).join(', ')}`);
      console.log(`    Created : ${t.createdAt} by ${t.createdBy}`);
      console.log(`    Expires : ${t.expiresAt ?? 'never'}`);
      if (t.lastUsedAt) console.log(`    Last use: ${t.lastUsedAt}`);
      console.log();
    });
  } finally {
    await client.close();
  }
}

async function cmdRevoke(id) {
  if (!id) return die('id is required');
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const col = client.db(DB_NAME).collection(COLLECTION);
    const res = await col.updateOne({ id }, { $set: { revokedAt: new Date().toISOString() } });
    if (res.matchedCount === 0) return die(`Token ${id} not found`);
    console.log(`\n  ✓ Token ${id} revoked.\n`);
  } finally {
    await client.close();
  }
}

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    } else {
      args._positional = args._positional ?? [];
      args._positional.push(argv[i]);
    }
  }
  return args;
}

function die(msg) { console.error(`\n  Error: ${msg}\n`); process.exit(1); }

// ── Main ──────────────────────────────────────────────────────────────────────

const [,, cmd, ...rest] = process.argv;
const args = parseArgs(rest);

switch (cmd) {
  case 'issue':
    await cmdIssue({ name: args.name, scopes: args.scopes, ttl: args.ttl, save: false });
    break;
  case 'save':
    await cmdIssue({ name: args.name, scopes: args.scopes, ttl: args.ttl, save: true });
    break;
  case 'list':
    await cmdList();
    break;
  case 'revoke':
    await cmdRevoke(args._positional?.[0] ?? args.id);
    break;
  default:
    console.log(`
  MCP Token CLI

  Commands:
    issue  --name <name> --scopes <s1,s2> [--ttl <days>]   Issue a token
    save   --name <name> --scopes <s1,s2> [--ttl <days>]   Issue + save to AI .env
    list                                                     List all tokens
    revoke <id>                                              Revoke a token

  Scopes: ${[...VALID_SCOPES].join(', ')}

  Examples:
    node scripts/mcp-token.js save --name "local-llm" --scopes "read:content,write:content"
    node scripts/mcp-token.js list
    node scripts/mcp-token.js revoke abc123
`);
}
