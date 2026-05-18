/**
 * W6a — Low-stock alert (operator-targeted).
 *
 * Sent to the operator when one or more products cross their inventory
 * threshold (reorder point). Transactional-mandatory ops email — no
 * unsubscribe footer, no marketing framing.
 *
 * No visual progress timeline — this is an at-a-glance restock worklist.
 * The body is a compact table of every product that tripped the
 * threshold; one focused CTA opens the inventory pane in admin.
 *
 * Note: the inventory-threshold trigger does not exist in the codebase
 * yet (`InventoryService` tracks `stock` per row but has no reorder-
 * point concept). This template ships ahead of its trigger so the
 * threshold worker, when built, has its email ready.
 */

import {emailShell, escape} from './_shared/layout';
import {button} from './_shared/components';
import {IEmailTheme} from './_shared/theme';

/** One product that crossed its reorder point. */
export interface LowStockItem {
    /** Product title shown to the operator. */
    title: string;
    /** SKU — the operator's canonical product handle. */
    sku: string;
    /** Current on-hand quantity. */
    currentStock: number;
    /** The threshold (reorder point) it fell to or below. */
    threshold: number;
}

export interface LowStockAlertInput {
    /** Every product currently at or below its reorder point. */
    items: LowStockItem[];
    /** Absolute admin URL to the inventory / warehouse pane. */
    inventoryAdminUrl: string;
}

export const lowStockAlertTemplate = {
    id: 'low-stock-alert',
    subject: (input: LowStockAlertInput): string => {
        const n = input.items.length;
        return n === 1
            ? `Low stock: ${input.items[0].title}`
            : `Low stock: ${n} products need restocking`;
    },
    html: (input: LowStockAlertInput, theme: IEmailTheme): string => {
        const rows = input.items.map(item => `<tr>
<td style="padding:10px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};vertical-align:top;">
<strong>${escape(item.title)}</strong><br>
<span style="color:${theme.colorInkMuted};font-size:12px;">${escape(item.sku)}</span>
</td>
<td align="right" style="padding:10px 0;font-family:${theme.fontFamilyBody};font-size:14px;white-space:nowrap;vertical-align:top;">
<strong style="color:${item.currentStock <= 0 ? theme.colorAccent : theme.colorInk};">${escape(item.currentStock)}</strong>
<span style="color:${theme.colorInkMuted};font-size:12px;"> / ${escape(item.threshold)}</span>
</td>
</tr>`).join('');
        return emailShell({
            title: lowStockAlertTemplate.subject(input),
            theme,
            preheader: `${input.items.length} product${input.items.length === 1 ? '' : 's'} at or below the reorder point.`,
            body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;line-height:30px;color:${theme.colorInk};">Low stock alert</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">The following ${input.items.length === 1 ? 'product has' : 'products have'} dropped to or below the reorder point. The right-hand column shows <em>on-hand / threshold</em>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0;">
<tr><td style="padding:0 0 6px 0;font-family:${theme.fontFamilyBody};font-size:12px;color:${theme.colorInkMuted};text-transform:uppercase;letter-spacing:0.04em;">Product</td>
<td align="right" style="padding:0 0 6px 0;font-family:${theme.fontFamilyBody};font-size:12px;color:${theme.colorInkMuted};text-transform:uppercase;letter-spacing:0.04em;">On hand / threshold</td></tr>
<tr><td colspan="2" style="padding:0;"><div style="height:1px;line-height:1px;background:${theme.colorBorder};">&nbsp;</div></td></tr>
${rows}
</table>
${button({label: 'Open inventory', href: input.inventoryAdminUrl}, theme)}
<p style="margin:16px 0 0 0;font-family:${theme.fontFamilyBody};font-size:12px;color:${theme.colorInkMuted};line-height:18px;">This is an automated operations alert. Restock these products or adjust their reorder points from the inventory pane.</p>
</td></tr>
            `,
        });
    },
    text: (input: LowStockAlertInput): string => {
        const lines = input.items
            .map(i => `  ${i.title} (${i.sku}) — ${i.currentStock} on hand / ${i.threshold} threshold`)
            .join('\n');
        return `Low stock alert

The following product${input.items.length === 1 ? ' has' : 's have'} dropped to or below the reorder point:

${lines}

Open inventory: ${input.inventoryAdminUrl}

This is an automated operations alert. Restock these products or adjust their
reorder points from the inventory pane.
`;
    },
    requiredFields: ['items', 'inventoryAdminUrl'] as const,
};
