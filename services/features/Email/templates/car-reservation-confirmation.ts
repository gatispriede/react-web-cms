/**
 * W6a — Car-reservation confirmation email.
 *
 * High-AOV trust anchor between an online reservation and the in-person
 * handover (ss.com cars flow — W7b). The reservation is a soft hold, not
 * a D2C purchase, so the email's job is to reduce anxiety and set
 * expectations: visual progress timeline → one focused CTA → the
 * reservation facts (car, deposit, hold window, VAT regime).
 *
 * Timeline: Reserved → Verification → Pickup scheduled → Handover.
 */

import {emailShell, escape} from './_shared/layout';
import {button, divider, formatMoney, progressStepper, Step} from './_shared/components';
import {IEmailTheme} from './_shared/theme';

export interface CarReservationConfirmationInput {
    customerName: string;
    /** Car listing title — e.g. "2018 BMW 330i xDrive". */
    carTitle: string;
    /** Reservation reference shown to the buyer + operator. */
    reservationId: string;
    /** Deposit amount in minor units. */
    depositAmount: number;
    /** ISO-4217 currency. */
    currency: string;
    /** Hold window copy — e.g. "48 hours" / "until Friday 18:00". */
    holdWindow: string;
    /** Free-form VAT regime note as a listing fact — e.g. "VAT margin scheme" / "VAT 21% deductible". */
    vatRegimeNote?: string;
    /** Pickup location copy — e.g. "Rīga, Brīvības iela 214". */
    pickupLocation?: string;
    /** Absolute URL to the reservation detail / listing page. */
    reservationViewUrl: string;
    /** Optional account-upgrade CTA — present for anonymous reservations. */
    accountUpgradeUrl?: string;
    unsubscribeUrl?: string;
}

export const carReservationConfirmationTemplate = {
    id: 'car-reservation-confirmation',
    subject: (input: CarReservationConfirmationInput): string =>
        `Reservation confirmed — ${input.carTitle}`,
    html: (input: CarReservationConfirmationInput, theme: IEmailTheme): string => {
        const steps: Step[] = [
            {label: 'Reserved', state: 'done', date: 'Today'},
            {label: 'Verification', state: 'active', date: `Within ${escape(input.holdWindow)}`},
            {label: 'Pickup scheduled', state: 'pending', date: 'After deposit'},
            {label: 'Handover', state: 'pending', date: input.pickupLocation ? input.pickupLocation : 'In person'},
        ];
        return emailShell({
            title: carReservationConfirmationTemplate.subject(input),
            theme,
            preheader: `${input.carTitle} held for you for ${input.holdWindow}.`,
            body: `
<tr><td class="email-pad" style="padding:32px 32px 24px 32px;">
<h1 style="margin:0 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:24px;line-height:30px;color:${theme.colorInk};">Hi ${escape(input.customerName)},</h1>
<p style="margin:0 0 16px 0;font-family:${theme.fontFamilyBody};font-size:16px;line-height:24px;color:${theme.colorInk};">We've placed a hold on <strong>${escape(input.carTitle)}</strong> for you. Here's what happens next:</p>
${progressStepper(steps, theme)}
${button({label: 'View reservation', href: input.reservationViewUrl}, theme)}
${divider(theme)}
<h2 style="margin:16px 0 8px 0;font-family:${theme.fontFamilyDisplay};font-size:18px;color:${theme.colorInk};">Reservation ${escape(input.reservationId)}</h2>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInkMuted};">Vehicle</td>
<td align="right" style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};">${escape(input.carTitle)}</td></tr>
<tr><td style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInkMuted};">Deposit to confirm</td>
<td align="right" style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;font-weight:700;color:${theme.colorInk};">${escape(formatMoney(input.depositAmount, input.currency))}</td></tr>
<tr><td style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInkMuted};">Hold window</td>
<td align="right" style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};">${escape(input.holdWindow)}</td></tr>
${input.vatRegimeNote ? `<tr><td style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInkMuted};">VAT regime</td>
<td align="right" style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};">${escape(input.vatRegimeNote)}</td></tr>` : ''}
${input.pickupLocation ? `<tr><td style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInkMuted};">Pickup location</td>
<td align="right" style="padding:4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};">${escape(input.pickupLocation)}</td></tr>` : ''}
</table>
<p style="margin:16px 0 0 0;font-family:${theme.fontFamilyBody};font-size:13px;color:${theme.colorInkMuted};line-height:20px;">This is a reservation, not a purchase. We'll be in touch within ${escape(input.holdWindow)} to verify details and arrange the deposit. The hold is released automatically if we don't hear back.</p>
${input.accountUpgradeUrl ? `${divider(theme)}
<p style="margin:12px 0 4px 0;font-family:${theme.fontFamilyBody};font-size:14px;color:${theme.colorInk};">Save your details to track this reservation?</p>
<p style="margin:8px 0;font-family:${theme.fontFamilyBody};font-size:14px;"><a href="${escape(input.accountUpgradeUrl)}" style="color:${theme.colorAccent};text-decoration:underline;">Create an account</a></p>` : ''}
</td></tr>
${input.unsubscribeUrl ? `<tr><td align="center" style="padding:12px 16px;font-family:${theme.fontFamilyBody};font-size:11px;color:${theme.colorInkMuted};">
You're receiving this because you reserved a vehicle. <a href="${escape(input.unsubscribeUrl)}" style="color:${theme.colorInkMuted};">Unsubscribe</a>.
</td></tr>` : ''}
            `,
        });
    },
    text: (input: CarReservationConfirmationInput): string => {
        return `Hi ${input.customerName},

We've placed a hold on ${input.carTitle} for you.

  Reserved -> Verification -> Pickup scheduled -> Handover
  (current: Verification — within ${input.holdWindow})

Reservation ${input.reservationId}
  Vehicle:            ${input.carTitle}
  Deposit to confirm: ${formatMoney(input.depositAmount, input.currency)}
  Hold window:        ${input.holdWindow}
${input.vatRegimeNote ? `  VAT regime:         ${input.vatRegimeNote}\n` : ''}${input.pickupLocation ? `  Pickup location:    ${input.pickupLocation}\n` : ''}
This is a reservation, not a purchase. We'll be in touch within ${input.holdWindow} to verify details and arrange the deposit.

View reservation: ${input.reservationViewUrl}
${input.accountUpgradeUrl ? `Save your details: ${input.accountUpgradeUrl}\n` : ''}`;
    },
    requiredFields: ['customerName', 'carTitle', 'reservationId', 'depositAmount', 'currency', 'holdWindow', 'reservationViewUrl'] as const,
};
