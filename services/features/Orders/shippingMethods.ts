import type {IOrderShippingMethod} from '@interfaces/IOrder';

/**
 * Hardcoded shipping methods. Real carrier-rate lookups would replace
 * this with an adapter; for v1 a flat per-order table is enough.
 *
 * Standard shipping is free over the threshold below to mirror the
 * spec's "free or $5" wording — no order-context yet, so we keep it
 * simple at $5 flat. Express is $15 flat.
 */

export const SHIPPING_METHODS: Record<string, IOrderShippingMethod> = {
    standard: {code: 'standard', label: 'Standard (5 days)', price: 500, etaDays: 5},
    express: {code: 'express', label: 'Express (next-day)', price: 1500, etaDays: 1},
};

export function shippingMethodList(): IOrderShippingMethod[] {
    return Object.values(SHIPPING_METHODS).map(m => ({...m}));
}

export function getShippingMethod(code: string): IOrderShippingMethod | null {
    const m = SHIPPING_METHODS[code];
    return m ? {...m} : null;
}
