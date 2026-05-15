/**
 * W6a — Account welcome email.
 *
 * Sent after a customer signs up (or upgrades from anonymous-checkout).
 * One focused CTA — head straight to the account / order history page.
 */

import {emailShell, escape} from './_shared/layout';
import {button} from './_shared/components';
import {IEmailTheme} from './_shared/theme';

export interface AccountWelcomeInput {
    customerName: string;
    /** Account / order-history URL. */
    accountUrl: string;
    /** Optional first-order summary line — e.g. "Your order #1042 is being prepared." */
    firstOrderSummary?: string;
}

export const accountWelcomeTemplate = {
    id: 'account-welcome',
    subject: (input: AccountWelcomeInput): string => `Welcome, ${input.customerName}`,
    html: (input: AccountWelcomeInput, theme: IEmailTheme): string => emailShell({
        title: accountWelcomeTemplate.subject(input),
        theme,
        preheader: 'Your account is ready.',
        body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;color:${theme.colorInk};">Welcome, ${escape(input.customerName)}</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">Your account is ready. You can track orders, save delivery addresses, and check out faster next time.</p>
${input.firstOrderSummary ? `<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInkMuted};">${escape(input.firstOrderSummary)}</p>` : ''}
${button({label: 'View account', href: input.accountUrl}, theme)}
</td></tr>
        `,
    }),
    text: (input: AccountWelcomeInput): string =>
        `Welcome, ${input.customerName}!\n\nYour account is ready: ${input.accountUrl}\n${input.firstOrderSummary ? '\n' + input.firstOrderSummary + '\n' : ''}`,
    requiredFields: ['customerName', 'accountUrl'] as const,
};
