/**
 * Order domain types — see docs/features/checkout.md.
 *
 * One document per order in the `Orders` collection. State machine and
 * field semantics are spelled out in the spec; this file is just the
 * shape. `IOrderStatusEntry` is a small append-only audit trail that
 * lives inline on the order rather than in a separate collection — the
 * order is the natural unit of consistency, and we never need to query
 * "all status changes by actor" the way we might for a real audit log.
 */

export type OrderStatus =
    | 'pending'
    | 'paid'
    | 'fulfilling'
    | 'shipped'
    | 'delivered'
    | 'cancelled'
    | 'refunded';

export interface IOrderLineItem {
    productId: string;
    sku: string;
    title: string;
    image?: string;
    quantity: number;
    /** Minor units (e.g. cents). Snapshot from cart at draft creation. */
    unitPrice: number;
    lineTotal: number;
    taxAmount?: number;
}

export interface IOrderAddress {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    phone?: string;
}

export interface IOrderStatusEntry {
    status: OrderStatus;
    at: string;
    by?: string;
    note?: string;
}

export interface IOrderShippingMethod {
    code: string;
    label: string;
    /** Minor units. */
    price: number;
    etaDays: number;
}

export interface IOrderPaymentRef {
    provider: 'mock' | 'stripe';
    authorizationId?: string;
    captureId?: string;
    refundId?: string;
    last4?: string;
    brand?: string;
}

export interface IOrderIdempotencyKeys {
    authorize?: string;
    finalize?: string;
}

export interface IOrder {
    id: string;
    orderNumber: string;
    customerId?: string;
    guestEmail?: string;
    /** Opaque token bound to the `order_token` cookie for guest confirmation reads. */
    orderToken?: string;

    lineItems: IOrderLineItem[];
    subtotal: number;
    shippingTotal: number;
    taxTotal: number;
    discountTotal: number;
    total: number;
    currency: string;

    shippingAddress?: IOrderAddress;
    billingAddress?: IOrderAddress;
    shippingMethod?: IOrderShippingMethod;

    paymentRef?: IOrderPaymentRef;
    idempotencyKeys: IOrderIdempotencyKeys;

    status: OrderStatus;
    statusHistory: IOrderStatusEntry[];

    /** ID of the StockReservations doc held during the checkout flow. */
    inventoryReservationId?: string;

    createdAt: string;
    updatedAt: string;
    version: number;
}

export class OrderError extends Error {
    public readonly code: string;
    public readonly details?: Record<string, unknown>;
    constructor(code: string, details?: Record<string, unknown>, message?: string) {
        super(message ?? code);
        this.name = 'OrderError';
        this.code = code;
        this.details = details;
    }
}

/** Allowed transitions per spec §3 mermaid diagram. */
export const ORDER_TRANSITIONS: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
    pending: ['paid', 'cancelled'],
    paid: ['fulfilling', 'refunded'],
    fulfilling: ['shipped', 'refunded'],
    shipped: ['delivered', 'refunded'],
    delivered: ['refunded'],
    cancelled: [],
    refunded: [],
};
