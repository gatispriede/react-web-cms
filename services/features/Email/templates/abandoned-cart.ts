/**
 * Phase 1.B-d — Abandoned-cart recovery email.
 *
 * Single template, one focused CTA → `/cart?resume=<token>`. Mobile-
 * first table layout (matches W6a primitives — see `_shared/layout.ts`).
 * When an operator-supplied discount code is set on
 * `commerce.abandonedCartDiscountCode`, an extra block surfaces it
 * verbatim; when empty, the block is omitted (no platform-side code
 * generation per the operator's binding decision).
 *
 * RFC 8058 one-click unsubscribe is stamped by `sendWithPreference`
 * when called with `category: 'marketing'` — the worker uses that
 * code-path so this template just renders the body and a footer that
 * surfaces the operator-supplied `unsubscribeUrl`.
 */

import {emailShell, escape} from './_shared/layout';
import {button, divider} from './_shared/components';
import {IEmailTheme} from './_shared/theme';

/** Line item shape the template renders. Decoupled from `CartLineItem`
 *  so the worker can resolve product titles + images at send-time and
 *  pass a flat array — the template stays trivially testable. */
export interface AbandonedCartLine {
    title: string;
    sku: string;
    qty: number;
    /** Minor units in `currency`, already times qty (caller does the math). */
    lineTotal: number;
    /** Optional product thumbnail. Omitted lines render text-only. */
    imageUrl?: string;
}

export interface AbandonedCartInput {
    customerName: string;
    lines: AbandonedCartLine[];
    /** ISO-4217. */
    currency: string;
    /** Cart subtotal in minor units. */
    subtotal: number;
    /** Absolute URL to `/cart?resume=<token>`. */
    resumeUrl: string;
    /** When set, an explicit discount block is rendered. Empty → no block. */
    discountCode?: string;
    /** Stamped by `sendWithPreference` (W8c / W8f). */
    unsubscribeUrl?: string;
}

function formatMoney(amount: number, currency: string): string {
    try {
        return new Intl.NumberFormat('en-US', {style: 'currency', currency}).format((amount ?? 0) / 100);
    } catch {
        return `${(amount ?? 0) / 100} ${currency}`;
    }
}

/** Tiny rendering helper for one line item — mobile-first, image-left. */
function lineRow(line: AbandonedCartLine, currency: string, t: IEmailTheme): string {
    const img = line.imageUrl
        ? `<td width="56" valign="top" style="padding-right:12px;"><img src="${escape(line.imageUrl)}" alt="" width="48" height="48" style="display:block;border-radius:4px;width:48px;height:48px;object-fit:cover;"></td>`
        : '';
    return `<tr><td style="padding:6px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>${img}<td valign="top" style="font-family:${t.fontFamilyBody};font-size:14px;color:${t.colorInk};">
<strong>${escape(line.title)}</strong><br>
<span style="color:${t.colorInkMuted};font-size:12px;">SKU ${escape(line.sku)} · qty ${line.qty}</span>
</td><td valign="top" align="right" style="font-family:${t.fontFamilyBody};font-size:14px;color:${t.colorInk};white-space:nowrap;">
${formatMoney(line.lineTotal, currency)}
</td></tr></table>
</td></tr>`;
}

export const abandonedCartTemplate = {
    id: 'abandoned-cart',
    subject: (_input: AbandonedCartInput): string => 'You left something in your cart',
    html: (input: AbandonedCartInput, theme: IEmailTheme): string => {
        const {customerName, lines, currency, subtotal, resumeUrl, discountCode, unsubscribeUrl} = input;
        const rows = lines.map(l => lineRow(l, currency, theme)).join('');
        const discountBlock = discountCode
            ? `${divider(theme)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:12px 16px;background:${theme.colorAccent}11;border:1px dashed ${theme.colorAccent};border-radius:8px;">
<div style="font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};">Use this code at checkout:</div>
<div style="font-family:${theme.fontFamilyDisplay};font-size:22px;font-weight:700;color:${theme.colorInk};letter-spacing:2px;margin-top:4px;">${escape(discountCode)}</div>
</td></tr></table>`
            : '';
        return emailShell({
            title: 'You left something in your cart',
            theme,
            preheader: `Pick up where you left off — ${formatMoney(subtotal, currency)} waiting for you.`,
            body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;line-height:30px;color:${theme.colorInk};">Hi ${escape(customerName)},</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">
We saved your cart so you can finish whenever you're ready.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;">
${rows}
</table>
${divider(theme)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInkMuted};">Subtotal</td>
<td align="right" style="font-family:${theme.fontFamilyBody};font-size:16px;font-weight:600;color:${theme.colorInk};">${formatMoney(subtotal, currency)}</td></tr>
</table>
${discountBlock}
${button({label: 'Continue your order', href: resumeUrl}, theme)}
</td></tr>
${unsubscribeUrl ? `<tr><td align="center" style="padding:12px 16px;font-family:${theme.fontFamilyBody};font-size:11px;color:${theme.colorInkMuted};">
You're receiving this because you have an active cart on our store. <a href="${escape(unsubscribeUrl)}" style="color:${theme.colorInkMuted};">Unsubscribe</a>.
</td></tr>` : ''}
            `,
        });
    },
    text: (input: AbandonedCartInput): string => {
        const {customerName, lines, currency, subtotal, resumeUrl, discountCode} = input;
        const itemLines = lines
            .map(l => `  ${l.title} (${l.sku}) × ${l.qty} — ${formatMoney(l.lineTotal, currency)}`)
            .join('\n');
        const discountLine = discountCode ? `\nUse code at checkout: ${discountCode}\n` : '';
        return `Hi ${customerName},

We saved your cart so you can finish whenever you're ready.

${itemLines}

  Subtotal: ${formatMoney(subtotal, currency)}
${discountLine}
Continue your order: ${resumeUrl}
`;
    },
    requiredFields: ['customerName', 'lines', 'currency', 'subtotal', 'resumeUrl'] as const,
};
