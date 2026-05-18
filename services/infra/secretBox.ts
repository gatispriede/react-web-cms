/**
 * secretBox — symmetric envelope encryption for at-rest secrets stored
 * in Mongo (SiteFlags `mail.smtpPassEncrypted`,
 * `mail.resendApiKeyEncrypted`, etc.).
 *
 * Envelope shape (after base64-decode):
 *
 *     [ 12-byte IV | ciphertext (variable) | 16-byte GCM auth tag ]
 *
 * Encoded as base64 in the database. AES-256-GCM provides both
 * confidentiality and tamper-detection — `decrypt` throws on any byte
 * change anywhere in the envelope, including the IV.
 *
 * Master key sourced from `process.env.SECRETBOX_KEY` (32-byte base64).
 * If unset on boot we log a one-shot warning and fall back to PLAINTEXT
 * storage — this keeps local dev painless and lets existing deployments
 * boot before the operator rotates keys, but it means the operator MUST
 * set `SECRETBOX_KEY` in production. The runbook documents the rotation
 * path.
 *
 * Key rotation: change `SECRETBOX_KEY`, redeploy. Existing ciphertexts
 * become unreadable; the operator re-enters secrets through the admin
 * UI which re-encrypts with the new key. There is no migration / dual-
 * key window — an operator-grade infra concern; documented as a
 * follow-up if it ever becomes a real problem.
 */

import {createCipheriv, createDecipheriv, randomBytes} from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

let warned = false;

function getKey(): Buffer | null {
    const raw = process.env.SECRETBOX_KEY;
    if (!raw) {
        if (!warned) {
            warned = true;
             
            console.warn(
                '[secretBox] SECRETBOX_KEY is not set — secrets will be ' +
                'stored in PLAINTEXT in the database. Set a 32-byte base64 ' +
                'key (e.g. `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"`) ' +
                'and redeploy to enable at-rest encryption.',
            );
        }
        return null;
    }
    let buf: Buffer;
    try {
        buf = Buffer.from(raw, 'base64');
    } catch {
        throw new Error('[secretBox] SECRETBOX_KEY is not valid base64');
    }
    if (buf.length !== KEY_LEN) {
        throw new Error(`[secretBox] SECRETBOX_KEY must decode to ${KEY_LEN} bytes (got ${buf.length})`);
    }
    return buf;
}

/**
 * Encrypt `plain` with AES-256-GCM. Returns base64(`iv ++ ciphertext ++
 * tag`). When `SECRETBOX_KEY` is unset the function returns `plain`
 * unchanged so the calling code can keep working in dev / unmigrated
 * deployments. The marker prefix lets `decrypt` distinguish wrapped
 * envelopes from plaintext fall-throughs.
 */
export function encrypt(plain: string): string {
    if (!plain) return plain;
    const key = getKey();
    if (!key) return plain;
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return 'sb1:' + Buffer.concat([iv, ct, tag]).toString('base64');
}

/**
 * Reverse of `encrypt`. Throws on tamper, malformed envelope, or wrong
 * key. Plaintext fall-throughs (no `sb1:` marker) pass through
 * unchanged so existing rows survive enabling encryption mid-flight.
 */
export function decrypt(boxed: string): string {
    if (!boxed) return boxed;
    if (!boxed.startsWith('sb1:')) return boxed;
    const key = getKey();
    if (!key) {
        throw new Error('[secretBox] cannot decrypt: SECRETBOX_KEY not set');
    }
    const buf = Buffer.from(boxed.slice(4), 'base64');
    if (buf.length < IV_LEN + TAG_LEN + 1) {
        throw new Error('[secretBox] envelope too short');
    }
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(buf.length - TAG_LEN);
    const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/**
 * Mask helper for safe display in UI / MCP responses. We expose only
 * the last 4 chars of the *plaintext* — enough for the operator to
 * identify which key is loaded, not enough to reconstruct it. For
 * encrypted envelopes we show a fixed marker since we don't decrypt
 * just to mask.
 */
export function mask(plainOrBoxed: string | undefined | null, prefix = 'sk'): string {
    if (!plainOrBoxed) return '';
    if (plainOrBoxed.startsWith('sb1:')) return `${prefix}_***[encrypted]`;
    const last4 = plainOrBoxed.slice(-4);
    return `${prefix}_***${last4}`;
}

/** Returns true when a value is a wrapped envelope (vs. plaintext). */
export function isEncrypted(v: string | undefined | null): boolean {
    return typeof v === 'string' && v.startsWith('sb1:');
}
