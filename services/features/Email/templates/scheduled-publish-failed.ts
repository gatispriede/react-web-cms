/**
 * W6a — Scheduled-publish-failure alert (operator-targeted).
 *
 * Sent to the operator when the release scheduler fails to publish a
 * release at its `scheduledFor` time (compensating-saga failure, write
 * conflict, mid-publish error). This is a transactional-mandatory ops
 * email — no unsubscribe footer, no marketing framing.
 *
 * No visual progress timeline — the operator needs the failure facts
 * (which release, why, what to do) front-and-centre, not a soothing
 * stepper. One focused CTA: open the release in admin to retry.
 */

import {emailShell, escape} from './_shared/layout';
import {button, divider} from './_shared/components';
import {IEmailTheme} from './_shared/theme';

export interface ScheduledPublishFailedInput {
    /** Release title shown to the operator. */
    releaseTitle: string;
    /** Release id — also used to build the admin deep-link. */
    releaseId: string;
    /** The error message captured on the failed release (`lastError`). */
    errorMessage: string;
    /** ISO timestamp the publish was scheduled for. */
    scheduledFor?: string;
    /** Number of content members the release would have published. */
    memberCount?: number;
    /** Absolute admin URL to the release detail / retry page. */
    releaseAdminUrl: string;
}

export const scheduledPublishFailedTemplate = {
    id: 'scheduled-publish-failed',
    subject: (input: ScheduledPublishFailedInput): string =>
        `Action needed: scheduled publish failed — ${input.releaseTitle}`,
    html: (input: ScheduledPublishFailedInput, theme: IEmailTheme): string => {
        return emailShell({
            title: scheduledPublishFailedTemplate.subject(input),
            theme,
            preheader: `Release "${input.releaseTitle}" did not publish. Retry from admin.`,
            body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;line-height:30px;color:${theme.colorInk};">Scheduled publish failed</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">The release <strong>${escape(input.releaseTitle)}</strong> did not publish at its scheduled time. Nothing went live — the content is unchanged and the release is marked <em>failed</em> so you can retry it.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInkMuted};">Release</td>
<td align="right" style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};">${escape(input.releaseTitle)}</td></tr>
<tr><td style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInkMuted};">Release id</td>
<td align="right" style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInk};">${escape(input.releaseId)}</td></tr>
${input.scheduledFor ? `<tr><td style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInkMuted};">Scheduled for</td>
<td align="right" style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};">${escape(input.scheduledFor)}</td></tr>` : ''}
${typeof input.memberCount === 'number' ? `<tr><td style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInkMuted};">Items affected</td>
<td align="right" style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};">${escape(input.memberCount)}</td></tr>` : ''}
</table>
${divider(theme)}
<p style="margin:12px 0 4px 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};">Error</p>
<p style="margin:0 0 8px 0;font-family:${theme.fontFamilyBody};font-size:13px;line-height:20px;color:${theme.colorInk};white-space:pre-wrap;word-break:break-word;">${escape(input.errorMessage)}</p>
${button({label: 'Open release in admin', href: input.releaseAdminUrl}, theme)}
<p style="margin:16px 0 0 0;font-family:${theme.fontFamilyBody};font-size:12px;color:${theme.colorInkMuted};line-height:18px;">This is an automated operations alert. Review the error, fix the underlying cause, and retry the publish from the release page.</p>
</td></tr>
            `,
        });
    },
    text: (input: ScheduledPublishFailedInput): string => {
        return `Scheduled publish failed: ${input.releaseTitle}

The release did not publish at its scheduled time. Nothing went live — the
content is unchanged and the release is marked "failed" so you can retry it.

  Release:        ${input.releaseTitle}
  Release id:     ${input.releaseId}
${input.scheduledFor ? `  Scheduled for:  ${input.scheduledFor}\n` : ''}${typeof input.memberCount === 'number' ? `  Items affected: ${input.memberCount}\n` : ''}
Error:
${input.errorMessage}

Open release in admin: ${input.releaseAdminUrl}

This is an automated operations alert. Review the error, fix the underlying
cause, and retry the publish from the release page.
`;
    },
    requiredFields: ['releaseTitle', 'releaseId', 'errorMessage', 'releaseAdminUrl'] as const,
};
