/**
 * W8c — Email deliverability hardening.
 *
 * Suppression list shape persisted to Mongo collection `EmailSuppression`.
 * Any inbound `email.bounced` (hard) / `email.complained` Resend webhook
 * lands a row here; one-click unsubscribe (W8f) also writes here via
 * `kind: 'manual-unsubscribe'`. EmailService consults this list before
 * any outbound send.
 *
 * Predefined `kind` enum — keep stable; admin UI Selects + MCP tool input
 * schemas validate against this exact list.
 */

export type EmailSuppressionKind =
    | 'bounced-hard'
    | 'bounced-soft'
    | 'complained'
    | 'manual-unsubscribe'
    | 'operator-block';

export const EMAIL_SUPPRESSION_KINDS: EmailSuppressionKind[] = [
    'bounced-hard',
    'bounced-soft',
    'complained',
    'manual-unsubscribe',
    'operator-block',
];

export interface IEmailSuppression {
    /** Lowercased, trimmed email address — collection's unique key. */
    email: string;
    kind: EmailSuppressionKind;
    /** Free-form provider diagnostic (Resend's `bounce.message`, etc). */
    reason?: string;
    /** ISO timestamp the row landed. */
    addedAt: string;
    /** `webhook:resend` | actor email | `unsubscribe:one-click`. */
    addedBy?: string;
    /**
     * Optional expiry — soft bounces re-resolve themselves on next send
     * attempt after this point. Hard bounces / complaints leave it unset.
     */
    expiresAt?: string;
    /** Provider message-id that produced the event, when available. */
    sourceMessageId?: string;
}
