/**
 * W6a — Inquiry-acknowledgement email.
 *
 * Sent to the *visitor* after they submit the public-site contact form
 * ("Send a brief"). The operator-facing notification is a separate plain
 * email composed inline in `ui/client/pages/api/inquiry.ts`; this one is
 * the buyer-facing receipt — its job is to close the loop and set a
 * response expectation so the visitor isn't left wondering.
 *
 * No visual progress timeline — a single-step interaction. One focused
 * affordance: a clear "expected response within 24h" line plus an
 * optional CTA back to the site.
 */

import {emailShell, escape} from './_shared/layout';
import {button, divider} from './_shared/components';
import {IEmailTheme} from './_shared/theme';

export interface InquiryAcknowledgementInput {
    /** Submitter display name — falls back to "there" when blank. */
    customerName?: string;
    /** Topic line the visitor selected, if any — echoed back for context. */
    topic?: string;
    /** The message body the visitor sent — echoed so they have a copy. */
    message?: string;
    /** Response-time promise copy — defaults to "within 24 hours". */
    responseWindow?: string;
    /** Optional CTA URL back to the site (home / a relevant page). */
    siteUrl?: string;
}

export const inquiryAcknowledgementTemplate = {
    id: 'inquiry-acknowledgement',
    subject: (input: InquiryAcknowledgementInput): string =>
        input.topic ? `We got your message — ${input.topic}` : 'We got your message',
    html: (input: InquiryAcknowledgementInput, theme: IEmailTheme): string => {
        const responseWindow = input.responseWindow ?? 'within 24 hours';
        return emailShell({
            title: inquiryAcknowledgementTemplate.subject(input),
            theme,
            preheader: `Thanks for reaching out — we'll reply ${responseWindow}.`,
            body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;line-height:30px;color:${theme.colorInk};">Thanks, ${escape(input.customerName ?? 'there')}</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">We've received your message and a real person will get back to you <strong>${escape(responseWindow)}</strong>.</p>
${input.topic ? `<p style="margin:0 0 4px 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};">Topic</p>
<p style="margin:0 0 12px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};">${escape(input.topic)}</p>` : ''}
${input.message ? `${divider(theme)}
<p style="margin:12px 0 4px 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};">Your message</p>
<p style="margin:0;font-family:${theme.fontFamilyBody};font-size:14px;line-height:22px;color:${theme.colorInk};white-space:pre-wrap;">${escape(input.message)}</p>` : ''}
${input.siteUrl ? `${button({label: 'Back to the site', href: input.siteUrl}, theme)}` : ''}
<p style="margin:20px 0 0 0;font-family:${theme.fontFamilyBody};font-size:12px;color:${theme.colorInkMuted};line-height:18px;">If you didn't send this message, you can safely ignore this email — no action is needed.</p>
</td></tr>
            `,
        });
    },
    text: (input: InquiryAcknowledgementInput): string => {
        const responseWindow = input.responseWindow ?? 'within 24 hours';
        return `Thanks, ${input.customerName ?? 'there'},

We've received your message and a real person will get back to you ${responseWindow}.
${input.topic ? `\nTopic: ${input.topic}\n` : ''}${input.message ? `\nYour message:\n${input.message}\n` : ''}${input.siteUrl ? `\nBack to the site: ${input.siteUrl}\n` : ''}
If you didn't send this message, you can safely ignore this email.
`;
    },
    requiredFields: [] as const,
};
