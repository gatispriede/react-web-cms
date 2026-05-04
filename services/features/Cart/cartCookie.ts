import {createHmac, randomUUID, timingSafeEqual} from 'crypto';

/**
 * Cart cookie signing.
 *
 * Cookie format: `<uuid>.<hex-hmac-sha256(uuid, secret)>`.
 *
 * We support a list of secrets to allow rotation: any of the secrets
 * passes verification, but we always re-sign with the first ("active")
 * secret. The standard mechanism: rotate by prepending the new secret;
 * after one TTL all cookies have been re-signed and the old one can be
 * dropped.
 *
 * Secret resolution (in order):
 *   1. `CART_COOKIE_SECRET` env var (comma-separated list for rotation)
 *   2. `NEXTAUTH_SECRET` (fallback so dev doesn't need extra config —
 *      this is the same secret NextAuth signs JWTs with; carts are
 *      lower-stakes so reuse is acceptable).
 *
 * If neither is set we throw — never run with an unsigned cart cookie.
 */

const sign = (uuid: string, secret: string): string =>
    createHmac('sha256', secret).update(uuid).digest('hex');

export const COOKIE_NAME = 'cart_id';
/** 30 days, matches the Redis TTL — cookie expiry shouldn't outlive the data. */
export const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const safeEqualHex = (a: string, b: string): boolean => {
    if (a.length !== b.length) return false;
    try {
        return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
    } catch {
        return false;
    }
};

export function signCartId(uuid: string, secret: string): string {
    return `${uuid}.${sign(uuid, secret)}`;
}

/** Returns the verified UUID, or `null` if the cookie is missing/forged/malformed. */
export function verifyCartId(cookieValue: string | undefined | null, secrets: string[]): string | null {
    if (!cookieValue || typeof cookieValue !== 'string') return null;
    const dot = cookieValue.indexOf('.');
    if (dot <= 0 || dot === cookieValue.length - 1) return null;
    const uuid = cookieValue.slice(0, dot);
    const sig = cookieValue.slice(dot + 1);
    // UUID v4 shape — cheap structural guard against random garbage in
    // the cookie jar.
    if (!/^[0-9a-f-]{36}$/i.test(uuid)) return null;
    if (!/^[0-9a-f]+$/i.test(sig)) return null;
    for (const s of secrets) {
        if (!s) continue;
        const expected = sign(uuid, s);
        if (safeEqualHex(sig, expected)) return uuid;
    }
    return null;
}

export function getCartCookieSecrets(): string[] {
    const list = (process.env.CART_COOKIE_SECRET ?? '').split(',').map(s => s.trim()).filter(Boolean);
    if (list.length > 0) return list;
    const fallback = process.env.NEXTAUTH_SECRET;
    if (fallback) return [fallback];
    throw new Error('CART_COOKIE_SECRET (or NEXTAUTH_SECRET) is required for cart cookie signing');
}

/** Mints a fresh cart id signed with the **first** (active) secret. */
export function mintCartCookie(): {cartId: string; cookieValue: string} {
    const secrets = getCartCookieSecrets();
    const cartId = randomUUID();
    return {cartId, cookieValue: signCartId(cartId, secrets[0])};
}

export interface CookieAttrs {
    name: string;
    value: string;
    maxAge: number;
    httpOnly: boolean;
    sameSite: 'Lax';
    secure: boolean;
    path: string;
}

export function buildSetCookieHeader(value: string, opts: {secure?: boolean} = {}): string {
    const secure = opts.secure ?? process.env.NODE_ENV === 'production';
    const parts = [
        `${COOKIE_NAME}=${value}`,
        `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
    ];
    if (secure) parts.push('Secure');
    return parts.join('; ');
}
