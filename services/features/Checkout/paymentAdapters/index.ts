/**
 * Phase 1.B-c — payment adapters barrel.
 */
export type {IPaymentAdapter, IPaymentInput, IPaymentResult} from './IPaymentAdapter';
export {stripeAdapter} from './stripeAdapter';
export {bankTransferAdapter} from './bankTransferAdapter';
export {cashOnDeliveryAdapter} from './cashOnDeliveryAdapter';
export {listAllAdapters, listEnabledAdapters, listEnabledAdaptersSync, getAdapter} from './paymentRegistry';
