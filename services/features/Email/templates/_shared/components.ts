/**
 * W6a — Reusable email components.
 *
 * `button`, `divider`, `progressStepper`, `orderSummaryTable` — every
 * helper renders as a `<table>` so Outlook (and the long tail of plain
 * MUAs) renders identically to Webkit clients.
 *
 * One focused CTA per template — Klaviyo / Baymard research shows
 * receipt CTR collapses past one primary action. `button()` is the only
 * primary; `linkLine()` covers secondary affordances inline.
 */

import {escape} from './layout';
import {IEmailTheme} from './theme';
import {IOrder, IOrderLineItem} from '@interfaces/IOrder';

// ── Button ────────────────────────────────────────────────────────────

export interface ButtonOpts {
    label: string;
    href: string;
}

/**
 * Bulletproof button — table + tinted `<td>` background + padded anchor.
 * Outlook 2016+ honours the rounded radius via the inline border-radius;
 * pre-2016 Outlook falls back to a square button, which is fine.
 */
export function button(opts: ButtonOpts, t: IEmailTheme): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
<tr><td align="center" bgcolor="${t.colorAccent}" style="background:${t.colorAccent};border-radius:8px;">
<a href="${escape(opts.href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${t.fontFamilyBody};font-size:16px;font-weight:600;color:${t.colorAccentOn};text-decoration:none;border-radius:8px;">${escape(opts.label)}</a>
</td></tr></table>`;
}

// ── Divider ───────────────────────────────────────────────────────────

export function divider(t: IEmailTheme): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:8px 0;"><div style="height:1px;line-height:1px;background:${t.colorBorder};">&nbsp;</div></td></tr>
</table>`;
}

// ── Progress timeline ────────────────────────────────────────────────

export type StepState = 'done' | 'active' | 'pending';
export interface Step {
    label: string;
    state: StepState;
    /** Free-form date / status hint shown beneath the label. */
    date?: string;
}

/**
 * Horizontal 4–5-step timeline. Table-based: each column is a `<td>` so
 * the bar collapses gracefully on narrow viewports (320 px). Done /
 * active / pending get distinct fill + border treatments via inline
 * styles so no `<style>` block is required (Gmail-clip-safe).
 */
export function progressStepper(steps: Step[], t: IEmailTheme): string {
    if (steps.length === 0) return '';
    const colWidth = Math.floor(100 / steps.length);
    const cells = steps.map((s, i) => {
        const fill =
            s.state === 'done' ? t.colorAccent
            : s.state === 'active' ? t.colorAccent
            : t.colorBgCard;
        const border =
            s.state === 'pending' ? `2px solid ${t.colorBorder}` : `2px solid ${t.colorAccent}`;
        const labelColor = s.state === 'pending' ? t.colorInkMuted : t.colorInk;
        const isActive = s.state === 'active';
        return `<td valign="top" align="center" width="${colWidth}%" style="vertical-align:top;padding:0 4px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
<tr><td align="center">
<div style="width:18px;height:18px;line-height:18px;border-radius:50%;background:${fill};border:${border};margin:0 auto;${isActive ? `box-shadow:0 0 0 4px ${t.colorAccent}22;` : ''}">&nbsp;</div>
</td></tr></table>
<div class="step-label" style="margin-top:8px;font-family:${t.fontFamilyBody};font-size:13px;font-weight:${isActive ? 600 : 500};color:${labelColor};line-height:18px;">${escape(s.label)}</div>
${s.date ? `<div style="margin-top:2px;font-family:${t.fontFamilyBody};font-size:11px;color:${t.colorInkMuted};line-height:16px;">${escape(s.date)}</div>` : ''}
</td>`;
    }).join('');
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 24px 0;">
<tr>${cells}</tr>
</table>`;
}

// ── Money + line items ────────────────────────────────────────────────

/** Minor units → display string. `123450 cents EUR` → `€1,234.50`. */
export function formatMoney(minor: number, currency: string): string {
    const major = minor / 100;
    try {
        return new Intl.NumberFormat('en-IE', {style: 'currency', currency}).format(major);
    } catch {
        return `${major.toFixed(2)} ${currency}`;
    }
}

function lineItemRow(item: IOrderLineItem, currency: string, t: IEmailTheme): string {
    return `<tr>
<td style="padding:12px 0;font-family:${t.fontFamilyBody};font-size:14px;color:${t.colorInk};vertical-align:top;">
<strong>${escape(item.title)}</strong><br>
<span style="color:${t.colorInkMuted};font-size:12px;">${escape(item.sku)} × ${item.quantity}</span>
</td>
<td align="right" style="padding:12px 0;font-family:${t.fontFamilyBody};font-size:14px;color:${t.colorInk};white-space:nowrap;vertical-align:top;">
${escape(formatMoney(item.lineTotal, currency))}
</td>
</tr>`;
}

export interface OrderSummaryOptions {
    /** VAT label resolved upstream (W8g `VatRegimeService`). Examples:
     *  "VAT 21% — Latvia", "Reverse charge — VIES-verified". */
    vatLabel?: string;
}

/** Itemised receipt table — line items + subtotal + shipping + VAT + total. */
export function orderSummaryTable(order: IOrder, t: IEmailTheme, opts?: OrderSummaryOptions): string {
    const lines = order.lineItems.map(l => lineItemRow(l, order.currency, t)).join('');
    const totalRow = (label: string, value: string, bold = false) => `<tr>
<td style="padding:6px 0;font-family:${t.fontFamilyBody};font-size:14px;color:${t.colorInkMuted};">${escape(label)}</td>
<td align="right" style="padding:6px 0;font-family:${t.fontFamilyBody};font-size:14px;${bold ? `color:${t.colorInk};font-weight:700;` : `color:${t.colorInkMuted};`}white-space:nowrap;">${escape(value)}</td>
</tr>`;
    const vatLabel = opts?.vatLabel ?? 'VAT';
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
${lines}
<tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;line-height:1px;background:${t.colorBorder};">&nbsp;</div></td></tr>
${totalRow('Subtotal', formatMoney(order.subtotal, order.currency))}
${order.shippingTotal ? totalRow('Shipping', formatMoney(order.shippingTotal, order.currency)) : ''}
${order.taxTotal ? totalRow(vatLabel, formatMoney(order.taxTotal, order.currency)) : ''}
${order.discountTotal ? totalRow('Discount', `−${formatMoney(order.discountTotal, order.currency)}`) : ''}
<tr><td colspan="2" style="padding:6px 0;"><div style="height:1px;line-height:1px;background:${t.colorBorder};">&nbsp;</div></td></tr>
${totalRow('Total', formatMoney(order.total, order.currency), true)}
</table>`;
}

/** Inline supplementary link, used for secondary affordances. */
export function linkLine(label: string, href: string, t: IEmailTheme): string {
    return `<p style="margin:8px 0;font-family:${t.fontFamilyBody};font-size:14px;color:${t.colorInkMuted};">
<a href="${escape(href)}" style="color:${t.colorAccent};text-decoration:underline;">${escape(label)}</a>
</p>`;
}
