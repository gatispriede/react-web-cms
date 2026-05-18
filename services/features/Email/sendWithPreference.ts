/**
 * W8f — Pre-send preference check.
 *
 * Wraps `sendEmail` with the per-customer policy resolution from
 * `NotificationsService`. Callers pass the recipient email + a
 * `category` arg; we resolve the customer's prefs and decide whether
 * to send, suppress, queue past quiet hours, or buffer for the next
 * digest tick.
 *
 * Always stamps the `List-Unsubscribe` headers when we have a userId
 * for the recipient — that's the one-click unsubscribe surface Gmail /
 * Yahoo grade us on.
 */

import {sendEmail, EmailPayload, EmailSendResult} from './EmailService';
import {NotificationsService} from '@services/features/Notifications/NotificationsService';
import {mintUnsubscribeToken} from '@services/features/Notifications/unsubscribeToken';
import {getNotificationDeferralQueue} from '@services/features/Notifications/NotificationDeferralQueue';
import type {NotificationCategory, DigestCadence} from '@interfaces/INotificationPreferences';
import type {ISiteMailConfig} from '@services/features/Seo/SiteFlagsService';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {log} from '@services/infra/logger';

export interface SendWithPreferenceInput extends EmailPayload {
    category: NotificationCategory;
}

export interface SendWithPreferenceResult extends EmailSendResult {
    /** 'sent' | 'suppressed' | 'queued' | 'digest' */
    deliveryStatus: 'sent' | 'suppressed' | 'queued' | 'digest';
    reason?: string;
}

export async function sendWithPreference(
    notifications: NotificationsService,
    mail: ISiteMailConfig | undefined,
    siteUrl: string,
    input: SendWithPreferenceInput,
): Promise<SendWithPreferenceResult> {
    const {category, ...emailPayload} = input;
    const {userId, prefs} = await notifications.getPreferencesByEmail(emailPayload.to);
    const decision = notifications.shouldSend(prefs, category);

    if (decision.decision === 'suppressed') {
        return {
            ok: false,
            deliveryStatus: 'suppressed',
            reason: decision.reason ?? 'opted-out',
            provider: 'disabled',
        };
    }
    if (decision.decision === 'queue' || decision.decision === 'digest') {
        // Polish bundle — persist on `NotificationDeferrals` so the
        // QuietHoursQueue + DigestCadenceWorker can flush at their
        // respective cadences. Failure to enqueue is non-fatal — we
        // still report the deferral so the caller's audit trail is
        // correct, and the EmailLog records the suppression separately.
        try {
            const db = getMongoConnection().database;
            const q = getNotificationDeferralQueue(db);
            if (q) {
                const reason: 'quiet-hours' | DigestCadence = decision.decision === 'queue'
                    ? 'quiet-hours'
                    : ((prefs?.digestCadence ?? 'daily') as DigestCadence);
                await q.enqueue({
                    userId: userId ?? undefined,
                    to: emailPayload.to,
                    category,
                    reason,
                    payload: emailPayload,
                });
            }
        } catch (err) {
            log.warn({scope: 'sendWithPreference.enqueue', err}, 'deferral enqueue failed; dropping');
        }
        return {
            ok: false,
            deliveryStatus: decision.decision === 'queue' ? 'queued' : 'digest',
            reason: decision.reason,
            provider: mail?.provider as any,
        };
    }

    // Stamp RFC 8058 headers when we have a userId — anonymous /
    // inquiry-only recipients (no row in Users) don't get a token.
    const headers: EmailPayload = {...emailPayload};
    if (userId && siteUrl) {
        const base = siteUrl.replace(/\/$/, '');
        const oneClickToken = mintUnsubscribeToken(userId, category);
        headers.listUnsubscribeUrl = `${base}/api/unsubscribe/${oneClickToken}`;
        if (mail?.from) {
            // Best-effort mailto target — operators using a transactional
            // alias usually accept replies; we fall back to the from
            // address. Always overridable per send via `extraHeaders`.
            const mailto = extractEmail(mail.from);
            if (mailto) headers.listUnsubscribeMailto = `${mailto}?subject=unsubscribe`;
        }
    }

    if (!decision.email) {
        // Customer wants inbox only — write the inbox row, skip the email send.
        if (decision.inbox && userId) {
            try {
                await notifications.writeInbox({
                    userId,
                    category,
                    title: input.subject,
                    body: stripHtmlPreview(input.html ?? input.text),
                    deliveredChannels: ['inbox'],
                });
            } catch { /* non-fatal */ }
        }
        return {ok: true, deliveryStatus: 'sent', reason: 'inbox-only', provider: 'disabled'};
    }

    const result = await sendEmail(mail, headers);
    if (result.ok && decision.inbox && userId) {
        try {
            await notifications.writeInbox({
                userId,
                category,
                title: input.subject,
                body: stripHtmlPreview(input.html ?? input.text),
                deliveredChannels: ['email', 'inbox'],
            });
        } catch { /* non-fatal — email already went out */ }
    }
    return {...result, deliveryStatus: result.ok ? 'sent' : 'suppressed'};
}

function stripHtmlPreview(s: string): string {
    return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
}

function extractEmail(from: string): string | null {
    const m = from.match(/<([^>]+)>/);
    if (m) return m[1].trim();
    if (/@/.test(from)) return from.trim();
    return null;
}
