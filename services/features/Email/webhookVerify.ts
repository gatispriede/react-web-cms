/**
 * W8c — Resend webhook signature verification.
 *
 * Resend uses the Standard Webhooks spec (also what `svix` consumes):
 *
 *   - Headers:
 *       svix-id         — message id
 *       svix-timestamp  — unix seconds
 *       svix-signature  — space-separated list of `v1,<base64-hmac>`
 *
 *   - Signed payload = `${id}.${timestamp}.${rawBody}`
 *   - HMAC = HMAC-SHA256(signedPayload, secretKeyBytes)  → base64
 *
 * Resend's secret comes in the form `whsec_<base64>`; the secret-key
 * bytes are the base64-decoded suffix. We accept either with-prefix
 * or already-decoded raw base64 to keep the operator happy.
 *
 * We don't pull in `svix` itself — the verification is ~20 lines of
 * Node crypto and pulling a dep for one HMAC is wasteful. If Resend
 * ever changes the scheme we swap this file out.
 */

import {createHmac, timingSafeEqual} from 'crypto';

const MAX_AGE_MS = 5 * 60_000; // 5 minutes — matches Standard Webhooks recommendation

export interface ResendWebhookEvent {
    type: string;
    created_at?: string;
    data?: Record<string, unknown>;
    [k: string]: unknown;
}

export class WebhookVerifyError extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
        this.name = 'WebhookVerifyError';
    }
}

function secretBytes(secret: string): Buffer {
    const stripped = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
    try {
        return Buffer.from(stripped, 'base64');
    } catch {
        // Fall back to raw utf8 — some operators paste an unprefixed
        // plaintext key. HMAC tolerates either.
        return Buffer.from(stripped, 'utf8');
    }
}

function pickHeader(headers: Record<string, string | string[] | undefined>, name: string): string {
    const v = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(v)) return v[0] ?? '';
    return v ?? '';
}

/**
 * Verify a Resend webhook request. Throws `WebhookVerifyError` on
 * any mismatch — callers MUST 4xx in that case.
 */
export function verifyResendWebhook(
    rawBody: string,
    headers: Record<string, string | string[] | undefined>,
    secret: string,
): ResendWebhookEvent {
    if (!secret) throw new WebhookVerifyError('NO_SECRET', 'RESEND_WEBHOOK_SECRET is not set');

    const id = pickHeader(headers, 'svix-id');
    const ts = pickHeader(headers, 'svix-timestamp');
    const sigHeader = pickHeader(headers, 'svix-signature');
    if (!id || !ts || !sigHeader) {
        throw new WebhookVerifyError('MISSING_HEADERS', 'Missing svix-id / svix-timestamp / svix-signature headers');
    }

    const tsNum = Number(ts) * 1000;
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > MAX_AGE_MS) {
        throw new WebhookVerifyError('STALE', `Timestamp ${ts} outside ${MAX_AGE_MS}ms window`);
    }

    const signed = `${id}.${ts}.${rawBody}`;
    const expected = createHmac('sha256', secretBytes(secret)).update(signed).digest('base64');
    const candidates = sigHeader
        .split(' ')
        .map(s => s.trim())
        .filter(s => s.startsWith('v1,'))
        .map(s => s.slice('v1,'.length));

    let matched = false;
    const expectedBuf = Buffer.from(expected, 'base64');
    for (const c of candidates) {
        let cb: Buffer;
        try { cb = Buffer.from(c, 'base64'); } catch { continue; }
        if (cb.length === expectedBuf.length && timingSafeEqual(cb, expectedBuf)) {
            matched = true;
            break;
        }
    }
    if (!matched) {
        throw new WebhookVerifyError('BAD_SIGNATURE', 'No signature matched');
    }

    try {
        return JSON.parse(rawBody) as ResendWebhookEvent;
    } catch (err) {
        throw new WebhookVerifyError('BAD_BODY', `Body is not valid JSON: ${(err as Error).message}`);
    }
}
