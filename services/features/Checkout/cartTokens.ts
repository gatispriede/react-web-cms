/**
 * Phase 1.B-d — Abandoned-cart resume tokens.
 *
 * The recovery email's "Continue your order" CTA links to
 * `/cart?resume=<token>`. The token is a signed envelope so a malicious
 * actor can't enumerate cart ids and read someone else's basket.
 *
 * Envelope shape (before base64-url-encoding):
 *
 *     `${cartIdOrCustomerId}|${kind}|${expiresAtMs}`
 *
 * `kind` is `customer` or `guest`; the cart resolver knows how to dispatch
 * either shape back into `CartService.getCart()`. Signing is delegated to
 * `secretBox.encrypt` (AES-256-GCM) — tamper-evident, key rotation aware,
 * graceful in dev when `SECRETBOX_KEY` is unset.
 *
 * Lifetime: 30 days. Matches the guest-cart Redis TTL, so a token can't
 * outlive the underlying basket.
 */

import {encrypt, decrypt} from '@services/infra/secretBox';

const TTL_DAYS = 30;
const TTL_MS = TTL_DAYS * 86_400_000;

/** Distinguishes the two backends so the resolver picks the right load path. */
export type CartTokenKind = 'customer' | 'guest';

export interface ResumeTokenPayload {
    kind: CartTokenKind;
    /** Customer id for `kind: 'customer'`; guest cart id for `kind: 'guest'`. */
    id: string;
    /** Epoch ms; the consumer rejects on expiry. */
    expiresAt: number;
}

/**
 * Mint a signed resume token. The returned string is URL-safe (`base64url`
 * via the `sb1:` envelope's standard base64 → quick replace) so it slots
 * into a query string without `encodeURIComponent` shenanigans.
 */
export function mintResumeToken(
    id: string,
    kind: CartTokenKind = 'customer',
    now: () => number = Date.now,
): string {
    if (!id) throw new Error('mintResumeToken: id required');
    const expiresAt = now() + TTL_MS;
    const inner = `${id}|${kind}|${expiresAt}`;
    const wrapped = encrypt(inner);
    // Convert standard base64 → base64url so the token survives a raw
    // query string. `secretBox.encrypt` returns either `sb1:<b64>` (key
    // present) or the plaintext (dev fallback). We url-safe-encode either
    // way — the consumer reverses the transform.
    return wrapped.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Result envelope for `redeemResumeToken` — `ok` false carries the reason. */
export type RedeemResult =
    | {ok: true; payload: ResumeTokenPayload}
    | {ok: false; reason: 'malformed' | 'expired' | 'tampered'};

/**
 * Verify + decode a resume token. The caller (cart page server-side
 * loader) then dispatches `CartService.getCart(...)` against the
 * resolved owner. Failure modes are reported via `reason` so the UI
 * can render a meaningful "expired" message rather than a generic 500.
 */
export function redeemResumeToken(
    token: string,
    now: () => number = Date.now,
): RedeemResult {
    if (typeof token !== 'string' || !token) return {ok: false, reason: 'malformed'};
    // Reverse the url-safe encoding.
    let restored = token.replace(/-/g, '+').replace(/_/g, '/');
    // Re-pad to a multiple of 4 — base64 decode is strict on length.
    const pad = restored.length % 4;
    if (pad) restored += '='.repeat(4 - pad);
    let inner: string;
    try {
        inner = decrypt(restored);
    } catch {
        return {ok: false, reason: 'tampered'};
    }
    const parts = inner.split('|');
    if (parts.length !== 3) return {ok: false, reason: 'malformed'};
    const [id, kind, expiresAtStr] = parts;
    const expiresAt = Number(expiresAtStr);
    if (!id || (kind !== 'customer' && kind !== 'guest') || !Number.isFinite(expiresAt)) {
        return {ok: false, reason: 'malformed'};
    }
    if (expiresAt < now()) return {ok: false, reason: 'expired'};
    return {ok: true, payload: {id, kind, expiresAt}};
}

/** Exposed for tests + the runbook's clock-arithmetic example. */
export const RESUME_TOKEN_TTL_MS = TTL_MS;
