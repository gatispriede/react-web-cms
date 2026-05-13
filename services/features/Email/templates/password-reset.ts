/**
 * W6a — Password-reset email.
 *
 * Single focused CTA (Reset password) + token-expiry note + ignore-if-
 * not-you safety line. Shares the shell + button helpers — no visual
 * timeline (single-step action).
 */

import {emailShell, escape} from './_shared/layout';
import {button} from './_shared/components';
import {IEmailTheme} from './_shared/theme';

export interface PasswordResetInput {
    customerName?: string;
    /** Reset URL with single-use token. */
    resetUrl: string;
    /** Minutes until token expires — defaults to 30. */
    expiryMinutes?: number;
}

export const passwordResetTemplate = {
    id: 'password-reset',
    subject: (_input: PasswordResetInput): string => 'Reset your password',
    html: (input: PasswordResetInput, theme: IEmailTheme): string => {
        const expiry = input.expiryMinutes ?? 30;
        return emailShell({
            title: 'Reset your password',
            theme,
            preheader: `Tap to reset. Link expires in ${expiry} minutes.`,
            body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;color:${theme.colorInk};">Reset your password</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">Hi ${escape(input.customerName ?? 'there')}, tap below to choose a new password. This link expires in ${expiry} minutes.</p>
${button({label: 'Reset password', href: input.resetUrl}, theme)}
<p style="margin:16px 0 0 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};line-height:20px;">Or copy this URL:<br>
<a href="${escape(input.resetUrl)}" style="color:${theme.colorAccent};word-break:break-all;">${escape(input.resetUrl)}</a></p>
<p style="margin:20px 0 0 0;font-family:${theme.fontFamilyBody};font-size:12px;color:${theme.colorInkMuted};">If you didn't ask to reset your password, just ignore this email — your existing password keeps working.</p>
</td></tr>
            `,
        });
    },
    text: (input: PasswordResetInput): string =>
        `Reset your password\n\nTap the link to choose a new password:\n${input.resetUrl}\n\nThis link expires in ${input.expiryMinutes ?? 30} minutes. If you didn't ask to reset, ignore this email.\n`,
    requiredFields: ['resetUrl'] as const,
};
