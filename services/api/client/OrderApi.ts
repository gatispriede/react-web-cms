import {resolve} from '@services/api/generated';
import type {IOrder, IOrderAddress, OrderStatus, IOrderShippingMethod} from '@interfaces/IOrder';

const parse = <T,>(raw: string | null | undefined, fallback: T): T => {
    if (!raw) return fallback;
    try { return JSON.parse(raw) as T; }
    catch { return fallback; }
};

export interface AuthorizeOrderResult {
    ok: boolean;
    orderId: string;
    declineCode?: string;
}

/**
 * Thin client over the GraphQL `String!` envelopes for Orders. Mirrors
 * the InventoryApi shape: every method parses the JSON envelope and
 * returns either the unwrapped payload or `{error}`.
 */
export class OrderApi {
    async myOrders(limit = 25): Promise<IOrder[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.myOrders({limit}));
            const parsed = parse<IOrder[] | {error: string}>(raw, []);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            console.error('OrderApi.myOrders:', err);
            return [];
        }
    }

    async myOrder(id: string): Promise<IOrder | null> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.myOrder({id}));
            return parse<IOrder | null>(raw, null);
        } catch { return null; }
    }

    async orderByToken(token: string): Promise<IOrder | null> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.orderByToken({token}));
            return parse<IOrder | null>(raw, null);
        } catch { return null; }
    }

    async adminOrders(opts: {status?: OrderStatus; limit?: number} = {}): Promise<IOrder[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.adminOrders(opts));
            const parsed = parse<IOrder[] | {error: string}>(raw, []);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }

    async adminOrder(id: string): Promise<IOrder | null> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.adminOrder({id}));
            return parse<IOrder | null>(raw, null);
        } catch { return null; }
    }

    async shippingMethodsFor(orderId: string): Promise<IOrderShippingMethod[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.shippingMethodsFor({orderId}));
            const parsed = parse<IOrderShippingMethod[] | {error: string}>(raw, []);
            return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
    }

    async createDraftOrder(args: {cartId?: string; currency: string; guestEmail?: string}): Promise<IOrder | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.createDraftOrder(args));
            const parsed = parse<{createDraftOrder?: IOrder; error?: string}>(raw, {error: 'no response'});
            return parsed.createDraftOrder ?? (parsed as {error: string});
        } catch (err) { return {error: String(err)}; }
    }

    async attachOrderAddress(args: {orderId: string; shipping: IOrderAddress; billing?: IOrderAddress}): Promise<IOrder | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.attachOrderAddress(args));
            const parsed = parse<{attachOrderAddress?: IOrder; error?: string}>(raw, {error: 'no response'});
            return parsed.attachOrderAddress ?? (parsed as {error: string});
        } catch (err) { return {error: String(err)}; }
    }

    async attachOrderShipping(args: {orderId: string; methodCode: string}): Promise<IOrder | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.attachOrderShipping(args));
            const parsed = parse<{attachOrderShipping?: IOrder; error?: string}>(raw, {error: 'no response'});
            return parsed.attachOrderShipping ?? (parsed as {error: string});
        } catch (err) { return {error: String(err)}; }
    }

    async authorizeOrderPayment(args: {orderId: string; card: any; idempotencyKey: string}): Promise<AuthorizeOrderResult | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.authorizeOrderPayment(args));
            const parsed = parse<{authorizeOrderPayment?: AuthorizeOrderResult; error?: string}>(raw, {error: 'no response'});
            return parsed.authorizeOrderPayment ?? (parsed as {error: string});
        } catch (err) { return {error: String(err)}; }
    }

    async finalizeOrder(args: {orderId: string; idempotencyKey: string}): Promise<IOrder | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.finalizeOrder(args));
            const parsed = parse<{finalizeOrder?: IOrder; error?: string}>(raw, {error: 'no response'});
            return parsed.finalizeOrder ?? (parsed as {error: string});
        } catch (err) { return {error: String(err)}; }
    }

    async cancelOrder(orderId: string): Promise<IOrder | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.cancelOrder({orderId}));
            const parsed = parse<{cancelOrder?: IOrder; error?: string}>(raw, {error: 'no response'});
            return parsed.cancelOrder ?? (parsed as {error: string});
        } catch (err) { return {error: String(err)}; }
    }

    async adminTransitionOrder(args: {orderId: string; next: OrderStatus; note?: string}): Promise<IOrder | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.adminTransitionOrder(args));
            const parsed = parse<{adminTransitionOrder?: IOrder; error?: string}>(raw, {error: 'no response'});
            return parsed.adminTransitionOrder ?? (parsed as {error: string});
        } catch (err) { return {error: String(err)}; }
    }

    async adminRefundOrder(args: {orderId: string; amount?: number; reason?: string}): Promise<IOrder | {error: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.adminRefundOrder(args));
            const parsed = parse<{adminRefundOrder?: IOrder; error?: string}>(raw, {error: 'no response'});
            return parsed.adminRefundOrder ?? (parsed as {error: string});
        } catch (err) { return {error: String(err)}; }
    }
}

export default OrderApi;
