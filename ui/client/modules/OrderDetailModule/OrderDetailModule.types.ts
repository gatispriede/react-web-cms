import type {OrderProgressStep, OrderProgressVariant} from '@client/modules/OrderProgressTimeline/OrderProgressTimeline.types';

export interface OrderLineItem {
    sku: string;
    title: string;
    quantity: number;
    lineTotalFormatted: string;
    thumbUrl?: string;
}

export interface OrderAddress {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    region?: string;
    postalCode: string;
    country: string;
}

export interface OrderPaymentSummary {
    subtotalFormatted: string;
    shippingFormatted: string;
    taxFormatted: string;
    totalFormatted: string;
    /** Payment method blurb, e.g. 'Visa ending 4242'. */
    method?: string;
}

export interface OrderStatusHistoryEntry {
    status: string;
    at: string;
    note?: string;
}

export interface OrderDetailActions {
    /** When true, reorder button shown. */
    canReorder?: boolean;
    onReorder?: () => void | Promise<void>;
    /** When true, cancel button shown. */
    canCancel?: boolean;
    onCancel?: () => void | Promise<void>;
    /** Always shown — contact support. */
    onContactSupport?: () => void;
    /** Caller-supplied label overrides. */
    reorderLabel?: string;
    cancelLabel?: string;
    supportLabel?: string;
}

export interface OrderDetailModuleProps {
    testId: string;
    orderNumber: string;
    /** OrderProgressTimeline data. */
    progressVariant?: OrderProgressVariant;
    progressSteps: OrderProgressStep[];
    lineItems: OrderLineItem[];
    shippingAddress?: OrderAddress;
    billingAddress?: OrderAddress;
    payment: OrderPaymentSummary;
    statusHistory: OrderStatusHistoryEntry[];
    actions?: OrderDetailActions;
}
