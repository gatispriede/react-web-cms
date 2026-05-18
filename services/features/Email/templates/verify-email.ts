/**
 * W6a — Email-verification template.
 *
 * Sent on signup or when a customer changes their email address. Single
 * focused CTA (Verify email) + token-expiry note. No visual timeline —
 * one-step action, no anxiety pattern to soothe.
 */

import {emailShell, escape} from './_shared/layout';
import {button} from './_shared/components';
import {IEmailTheme} from './_shared/theme';

export interface VerifyEmailInput {
    customerName?: string;
    /** Absolute verification URL with embedded single-use token. */
    verifyUrl: string;
    /** Minutes until the token expires — defaults to 60. */
    expiryMinutes?: number;
    /** True when this verifies a *changed* address rather than a new signup. */
    isEmailChange?: boolean;
}

export const verifyEmailTemplate = {
    id: 'verify-email',
    subject: (input: VerifyEmailInput): string =>
        input.isEmailChange ? 'Confirm your new email address' : 'Verify your email address',
    html: (input: VerifyEmailInput, theme: IEmailTheme): string => {
        const expiry = input.expiryMinutes ?? 60;
        const heading = input.isEmailChange ? 'Confirm your new email' : 'Verify your email';
        return emailShell({
            title: verifyEmailTemplate.subject(input),
            theme,
            preheader: `Tap to confirm. Link expires in ${expiry} minutes.`,
            body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;color:${theme.colorInk};">${escape(heading)}</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">Hi ${escape(input.customerName ?? 'there')}, ${input.isEmailChange ? 'tap below to confirm this is your new email address' : 'tap below to confirm your email address and finish setting up your account'}. This link expires in ${expiry} minutes.</p>
${button({label: input.isEmailChange ? 'Confirm email' : 'Verify email', href: input.verifyUrl}, theme)}
<p style="margin:16px 0 0 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};line-height:20px;">If the button doesn't work, copy and paste this URL into your browser:<br>
<a href="${escape(input.verifyUrl)}" style="color:${theme.colorAccent};word-break:break-all;">${escape(input.verifyUrl)}</a></p>
<p style="margin:20px 0 0 0;font-family:${theme.fontFamilyBody};font-size:12px;color:${theme.colorInkMuted};">If you didn't ${input.isEmailChange ? 'change your email' : 'create an account'}, just ignore this email — nothing will change.</p>
</td></tr>
            `,
        });
    },
    text: (input: VerifyEmailInput): string => {
        const expiry = input.expiryMinutes ?? 60;
        return `${verifyEmailTemplate.subject(input)}\n\nTap to confirm: ${input.verifyUrl}\n\nThis link expires in ${expiry} minutes and can only be used once.\n\nIf you didn't ${input.isEmailChange ? 'change your email' : 'create an account'}, just ignore this email.\n`;
    },
    requiredFields: ['verifyUrl'] as const,
};
