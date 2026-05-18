/**
 * W6a — Carrier-handoff "your order shipped" email.
 *
 * Re-uses the progress timeline + receipt body shape; swaps the headline
 * + adds an optional carrier-tracking link.
 */

import {emailShell, escape} from './_shared/layout';
import {button, divider, progressStepper, Step} from './_shared/components';
import {IEmailTheme} from './_shared/theme';
import {IOrder} from '@interfaces/IOrder';

export interface ShippedInput {
    order: IOrder;
    customerName: string;
    /** Carrier-supplied tracking URL — when present, becomes the primary CTA. */
    trackingUrl?: string;
    trackingNumber?: string;
    carrierName?: string;
    /** Fallback CTA when no tracking URL — points at the order page. */
    orderViewUrl: string;
    unsubscribeUrl?: string;
}

export const shippedTemplate = {
    id: 'shipped',
    subject: (input: ShippedInput): string =>
        `Your order ${input.order.orderNumber || input.order.id.slice(0, 8)} has shipped`,
    html: (input: ShippedInput, theme: IEmailTheme): string => {
        const steps: Step[] = [
            {label: 'Placed', state: 'done'},
            {label: 'Paid', state: 'done'},
            {label: 'Fulfilling', state: 'done'},
            {label: 'Shipped', state: 'active', date: new Date().toLocaleDateString()},
            {label: 'Delivered', state: 'pending'},
        ];
        const cta = input.trackingUrl
            ? button({label: 'Track package', href: input.trackingUrl}, theme)
            : button({label: 'View order', href: input.orderViewUrl}, theme);
        return emailShell({
            title: shippedTemplate.subject(input),
            theme,
            preheader: input.carrierName ? `${input.carrierName}${input.trackingNumber ? ` · ${input.trackingNumber}` : ''}` : 'Your order is on the way',
            body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;color:${theme.colorInk};">It's on the way, ${escape(input.customerName)}</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">Your order has been handed to ${escape(input.carrierName ?? 'the courier')}.</p>
${progressStepper(steps, theme)}
${cta}
${divider(theme)}
${input.trackingNumber ? `<p style="margin:8px 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};">Tracking number: <strong style="color:${theme.colorInk};">${escape(input.trackingNumber)}</strong></p>` : ''}
<p style="margin:8px 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};">Order ${escape(input.order.orderNumber || input.order.id.slice(0, 8))}</p>
</td></tr>
${input.unsubscribeUrl ? `<tr><td align="center" style="padding:12px 16px;font-family:${theme.fontFamilyBody};font-size:11px;color:${theme.colorInkMuted};">
<a href="${escape(input.unsubscribeUrl)}" style="color:${theme.colorInkMuted};">Unsubscribe</a>
</td></tr>` : ''}
            `,
        });
    },
    text: (input: ShippedInput): string =>
        `Your order ${input.order.orderNumber || input.order.id.slice(0, 8)} has shipped.\n\n${input.carrierName ? `Carrier: ${input.carrierName}\n` : ''}${input.trackingNumber ? `Tracking: ${input.trackingNumber}\n` : ''}${input.trackingUrl ? `Track: ${input.trackingUrl}\n` : `View order: ${input.orderViewUrl}\n`}`,
    requiredFields: ['order', 'customerName', 'orderViewUrl'] as const,
};
