/**
 * W6a — Magic-link sign-in template.
 *
 * Used by the upcoming W6c signup flow (passwordless email login).
 * Single focused CTA + 15-minute expiry note; no visual timeline (one-
 * step action, no anxiety pattern to soothe).
 */

import {emailShell, escape} from './_shared/layout';
import {button} from './_shared/components';
import {IEmailTheme} from './_shared/theme';

export interface MagicLinkInput {
    /** Display name — falls back to "there" if anonymous. */
    customerName?: string;
    /** Absolute magic-link URL with embedded one-time token. */
    magicUrl: string;
    /** Minutes until token expires — defaults to 15. */
    expiryMinutes?: number;
    /** Short label for the requesting client/IP — surfaced for security awareness. */
    requestContext?: string;
}

export const magicLinkTemplate = {
    id: 'magic-link',
    subject: (_input: MagicLinkInput): string => 'Your sign-in link',
    html: (input: MagicLinkInput, theme: IEmailTheme): string => {
        const expiry = input.expiryMinutes ?? 15;
        return emailShell({
            title: 'Your sign-in link',
            theme,
            preheader: `Tap to sign in. Link expires in ${expiry} minutes.`,
            body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;color:${theme.colorInk};">Sign in, ${escape(input.customerName ?? 'there')}</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">Tap the button below to finish signing in. This link is single-use and expires in ${expiry} minutes.</p>
${button({label: 'Sign in', href: input.magicUrl}, theme)}
<p style="margin:16px 0 0 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};line-height:20px;">If the button doesn't work, copy and paste this URL into your browser:<br>
<a href="${escape(input.magicUrl)}" style="color:${theme.colorAccent};word-break:break-all;">${escape(input.magicUrl)}</a></p>
${input.requestContext ? `<p style="margin:20px 0 0 0;font-family:${theme.fontFamilyBody};font-size:12px;color:${theme.colorInkMuted};line-height:18px;">Requested from: ${escape(input.requestContext)}. If this wasn't you, you can safely ignore this email — no action is needed.</p>` : `<p style="margin:20px 0 0 0;font-family:${theme.fontFamilyBody};font-size:12px;color:${theme.colorInkMuted};">If you didn't request this, just ignore the message — your account is safe.</p>`}
</td></tr>
            `,
        });
    },
    text: (input: MagicLinkInput): string => {
        const expiry = input.expiryMinutes ?? 15;
        return `Sign in to your account\n\nTap to sign in: ${input.magicUrl}\n\nThis link expires in ${expiry} minutes and can only be used once.\n\nIf you didn't request this, just ignore this email — your account is safe.\n`;
    },
    requiredFields: ['magicUrl'] as const,
};
