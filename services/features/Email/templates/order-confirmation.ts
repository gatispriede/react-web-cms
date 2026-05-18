/**
 * W6a — Lightweight order-confirmation alias.
 *
 * The "receipt" template is the load-bearing one (visual progress + line
 * items + VAT line). `order-confirmation` is a thin wrapper that re-uses
 * the receipt body but lets the caller change the subject — useful when
 * the operator wants the inbox preview to read "Order confirmed" rather
 * than "Order … confirmed" with the number.
 */

import {receiptTemplate, ReceiptInput} from './receipt';
import {IEmailTheme} from './_shared/theme';

export const orderConfirmationTemplate = {
    id: 'order-confirmation',
    subject: (input: ReceiptInput): string =>
        `Your order is confirmed — ${input.order.orderNumber || input.order.id.slice(0, 8)}`,
    html: (input: ReceiptInput, theme: IEmailTheme): string => receiptTemplate.html(input, theme),
    text: (input: ReceiptInput): string => receiptTemplate.text(input),
    requiredFields: receiptTemplate.requiredFields,
};
