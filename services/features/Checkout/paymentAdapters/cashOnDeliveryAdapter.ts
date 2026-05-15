/**
 * Phase 1.B-c — Cash-on-delivery (offline) payment adapter.
 *
 * Pure-offline. On submit:
 *   - Order status → `pending-delivery`.
 *   - Payment recorded on operator mark-paid via existing OrdersService.
 */
import type {IPaymentAdapter, IPaymentInput, IPaymentResult} from './IPaymentAdapter';

export const cashOnDeliveryAdapter: IPaymentAdapter = {
    id: 'cashOnDelivery',
    displayName: 'Cash on delivery',

    isEnabled({flagEnabled}) {
        return flagEnabled;
    },

    async processPayment(_input: IPaymentInput): Promise<IPaymentResult> {
        return {
            ok: true,
            transactionId: null,
            orderStatusAfter: 'pending-delivery',
            note: 'Order placed. Pay the courier on delivery.',
        };
    },
};
