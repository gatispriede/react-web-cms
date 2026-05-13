/**
 * W8f — Signed one-click unsubscribe tokens (RFC 8058).
 *
 * Token shape: base64url(`iv|ciphertext|tag`) per `secretBox.encrypt`.
 * Payload is JSON `{u: userId, c: category | '*', e: expiresAtMs}`.
 *
 * We piggy-back on the existing `secretBox` envelope so we don't
 * introduce a second key-management surface. Decryption auth-tags the
 * payload, so tampering throws — the API route can refuse on a 400
 * without leaking which field was changed.
 *
 * Expiry: tokens are good for 90 days. That matches typical email
 * archival; longer-lived tokens are a phishing risk if the message ever
 * leaks.
 */

import {encrypt, decrypt} from '@services/infra/secretBox';
import type {NotificationCategory} from '@interfaces/INotificationPreferences';
import {NOTIFICATION_CATEGORIES} from '@interfaces/INotificationPreferences';

const DEFAULT_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export interface UnsubscribePayload {
    userId: string;
    category: NotificationCategory | '*';
    expiresAt: number;
}

export function mintUnsubscribeToken(userId: string, category: NotificationCategory | '*', ttlMs: number = DEFAULT_TTL_MS): string {
    if (!userId) throw new Error('userId required');
    if (category !== '*' && !NOTIFICATION_CATEGORIES.includes(category as NotificationCategory)) {
        throw new Error(`invalid category: ${category}`);
    }
    const payload: UnsubscribePayload = {
        userId,
        category,
        expiresAt: Date.now() + ttlMs,
    };
    const json = JSON.stringify({u: payload.userId, c: payload.category, e: payload.expiresAt});
    const boxed = encrypt(json);
    // URL-safe: base64url + strip sb1: prefix (replaced server-side on decode).
    return Buffer.from(boxed, 'utf8').toString('base64url');
}

export function verifyUnsubscribeToken(token: string): UnsubscribePayload | null {
    if (!token || typeof token !== 'string') return null;
    try {
        const boxed = Buffer.from(token, 'base64url').toString('utf8');
        const json = decrypt(boxed);
        const parsed = JSON.parse(json) as {u?: string; c?: string; e?: number};
        if (!parsed.u || !parsed.c || typeof parsed.e !== 'number') return null;
        if (parsed.c !== '*' && !NOTIFICATION_CATEGORIES.includes(parsed.c as NotificationCategory)) return null;
        if (Date.now() > parsed.e) return null;
        return {userId: parsed.u, category: parsed.c as NotificationCategory | '*', expiresAt: parsed.e};
    } catch {
        return null;
    }
}
