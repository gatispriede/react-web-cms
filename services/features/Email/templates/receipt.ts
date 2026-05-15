/**
 * W6a — Receipt / order-confirmation email.
 *
 * The high-AOV anxiety reducer: visual progress timeline → one focused
 * CTA → itemised summary with VAT line → optional account-upgrade
 * prompt (anonymous-checkout case) → unsubscribe-aware footer.
 *
 * Inputs are explicit (don't accept the raw IOrder + go fishing) so the
 * template renders deterministically against the fixture and against
 * the preview pane.
 */

import {emailShell, escape} from './_shared/layout';
import {button, divider, formatMoney, linkLine, orderSummaryTable, progressStepper, Step} from './_shared/components';
import {IEmailTheme} from './_shared/theme';
import {IOrder, OrderStatus} from '@interfaces/IOrder';

export interface ReceiptInput {
    order: IOrder;
    customerName: string;
    /** Absolute URL to the order-by-token (guest) or `/account/orders/<id>` page. */
    orderViewUrl: string;
    /** When set, shows the "Save details for next time" upgrade prompt — anonymous-checkout case. */
    accountUpgradeUrl?: string;
    /** VAT label (W8g) — e.g. "VAT 21% — Latvia", "Reverse charge — VIES-verified". */
    vatLabel?: string;
    /** Short-form next step copy — "Within 24 hours" / "By Friday" / etc. */
    nextStepDate?: string;
    /** Unsubscribe URL stamped by `sendWithPreference` (W8f). */
    unsubscribeUrl?: string;
}

/**
 * Map order status to the timeline state. We always show the same 5
 * steps (Placed → Paid → Fulfilling → Shipped → Delivered); the active /
 * done split is driven by the live status.
 */
function buildTimeline(order: IOrder, nextStepDate?: string): Step[] {
    const flow: OrderStatus[] = ['pending', 'paid', 'fulfilling', 'shipped', 'delivered'];
    const currentIdx = flow.indexOf(order.status);
    const labels = ['Placed', 'Paid', 'Fulfilling', 'Shipped', 'Delivered'];
    return flow.map((s, i): Step => {
        let state: Step['state'] = 'pending';
        if (currentIdx < 0) state = i === 0 ? 'active' : 'pending';
        else if (i < currentIdx) state = 'done';
        else if (i === currentIdx) state = 'active';
        // Date column: pull from statusHistory for completed/active steps,
        // fall back to the operator's "next step" hint for the active row.
        const histEntry = order.statusHistory.find(h => h.status === s);
        const date = histEntry
            ? new Date(histEntry.at).toLocaleDateString()
            : (state === 'active' ? nextStepDate : undefined);
        return {label: labels[i], state, date};
    });
}

export const receiptTemplate = {
    id: 'receipt',
    subject: (input: ReceiptInput): string =>
        `Order ${input.order.orderNumber || input.order.id.slice(0, 8)} confirmed`,
    html: (input: ReceiptInput, theme: IEmailTheme): string => {
        const {order, customerName, orderViewUrl, accountUpgradeUrl, nextStepDate, unsubscribeUrl} = input;
        const steps = buildTimeline(order, nextStepDate);
        // VAT label resolution (W8g): caller-supplied label wins; else
        // fall back to the regime's persisted note. This makes the
        // receipt show the regime line (e.g. "Reverse charge — VIES-
        // verified") even when callers haven't pre-formatted it.
        const vatLabel = input.vatLabel ?? order.vatRegime?.note;
        // Reverse-charge / export orders have `taxTotal === 0` so the
        // standard VAT row in `orderSummaryTable` is hidden; render the
        // regime note as a standalone line so invoice obligations
        // (B2B reverse-charge: must state regime on the invoice) hold.
        const showRegimeStandalone = Boolean(vatLabel) && (order.taxTotal ?? 0) === 0;
        return emailShell({
            title: receiptTemplate.subject(input),
            theme,
            preheader: `Total ${formatMoney(order.total, order.currency)} · order ${order.orderNumber || order.id.slice(0, 8)}`,
            body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;line-height:30px;color:${theme.colorInk};">Hi ${escape(customerName)},</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">Thanks for your order. Here's where it is:</p>
${progressStepper(steps, theme)}
${button({label: 'View order', href: orderViewUrl}, theme)}
${divider(theme)}
<h2 style="margin:16px 0 4px 0;font-family:${theme.fontFamilyDisplay};font-size:18px;color:${theme.colorInk};">Order ${escape(order.orderNumber || order.id.slice(0, 8))}</h2>
${orderSummaryTable(order, theme, {vatLabel})}
${showRegimeStandalone ? `<p style="margin:8px 0 0 0;font-family:${theme.fontFamilyBody};font-size:12px;color:${theme.colorInkMuted};font-style:italic;">${escape(vatLabel as string)}</p>` : ''}
${order.shippingAddress ? `<p style="margin:20px 0 4px 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};">Shipping to:</p>
<p style="margin:0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};line-height:20px;">
${escape(order.shippingAddress.name)}<br>
${escape(order.shippingAddress.line1)}${order.shippingAddress.line2 ? '<br>' + escape(order.shippingAddress.line2) : ''}<br>
${escape(order.shippingAddress.city)}, ${escape(order.shippingAddress.region)} ${escape(order.shippingAddress.postalCode)}<br>
${escape(order.shippingAddress.country)}
</p>` : ''}
${accountUpgradeUrl ? `${divider(theme)}
<p style="margin:12px 0 4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};">Save your details for next time?</p>
${linkLine('Create an account', accountUpgradeUrl, theme)}` : ''}
</td></tr>
${unsubscribeUrl ? `<tr><td align="center" style="padding:12px 16px;font-family:${theme.fontFamilyBody};font-size:11px;color:${theme.colorInkMuted};">
You're receiving this because you placed an order. <a href="${escape(unsubscribeUrl)}" style="color:${theme.colorInkMuted};">Unsubscribe</a>.
</td></tr>` : ''}
            `,
        });
    },
    text: (input: ReceiptInput): string => {
        const {order, customerName, orderViewUrl} = input;
        const lines = order.lineItems
            .map(l => `  ${l.title} (${l.sku}) × ${l.quantity} — ${formatMoney(l.lineTotal, order.currency)}`)
            .join('\n');
        const vatLabel = input.vatLabel ?? order.vatRegime?.note;
        const vatLine = (order.taxTotal ?? 0) > 0
            ? `  ${vatLabel ?? 'VAT'}:         ${formatMoney(order.taxTotal, order.currency)}\n`
            : (vatLabel ? `  ${vatLabel}\n` : '');
        return `Hi ${customerName},

Thanks for your order. Here's where it is:

  Placed → Paid → Fulfilling → Shipped → Delivered
  (current: ${order.status})

Order ${order.orderNumber || order.id.slice(0, 8)}
${lines}

  Subtotal:    ${formatMoney(order.subtotal, order.currency)}
  Shipping:    ${formatMoney(order.shippingTotal, order.currency)}
${vatLine}  Total:       ${formatMoney(order.total, order.currency)}

View order: ${orderViewUrl}
${input.accountUpgradeUrl ? `Save your details: ${input.accountUpgradeUrl}\n` : ''}
`;
    },
    requiredFields: ['order', 'customerName', 'orderViewUrl'] as const,
};
