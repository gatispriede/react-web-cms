/**
 * Tiny client-side cart hook.
 *
 * Wraps the GraphQL queries/mutations for the cart with optimistic
 * local state. Mutations send via the customer pages' `gql()` helper
 * (same path used by /account/*) — the cart cookie is sent same-origin
 * automatically by `credentials: 'same-origin'` in `_gqlClient.ts`.
 */
import {useCallback, useEffect, useState} from 'react';
import {gql} from '../../pages/account/_gqlClient';
import type {Cart} from '@interfaces/ICart';

const CART_QUERY = `{ mongo { cart } }`;
const ADD = `mutation($pid:String!,$sku:String!,$qty:Int!){ mongo { cartAddItem(productId:$pid, sku:$sku, qty:$qty) } }`;
const UPD = `mutation($pid:String!,$sku:String!,$qty:Int!){ mongo { cartUpdateQty(productId:$pid, sku:$sku, qty:$qty) } }`;
const REM = `mutation($pid:String!,$sku:String!){ mongo { cartRemoveItem(productId:$pid, sku:$sku) } }`;
const CLR = `mutation { mongo { cartClear } }`;

const EMPTY: Cart = {items: [], currency: null, subtotal: 0, updatedAt: ''};

const parse = (raw: string | undefined | null): Cart => {
    if (!raw) return EMPTY;
    try {
        const parsed = JSON.parse(raw);
        if (parsed?.error) return EMPTY;
        return {
            items: Array.isArray(parsed.items) ? parsed.items : [],
            currency: parsed.currency ?? null,
            subtotal: typeof parsed.subtotal === 'number' ? parsed.subtotal : 0,
            updatedAt: parsed.updatedAt ?? '',
            warnings: parsed.warnings,
        };
    } catch {
        return EMPTY;
    }
};

export interface UseCart {
    cart: Cart;
    loading: boolean;
    refresh: () => Promise<void>;
    addItem: (productId: string, sku: string, qty?: number) => Promise<Cart>;
    updateQty: (productId: string, sku: string, qty: number) => Promise<Cart>;
    removeItem: (productId: string, sku: string) => Promise<Cart>;
    clear: () => Promise<Cart>;
}

export function useCart(): UseCart {
    const [cart, setCart] = useState<Cart>(EMPTY);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const data = await gql(CART_QUERY);
            setCart(parse(data?.mongo?.cart));
        } catch {
            // network blip — keep last-known state
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void refresh(); }, [refresh]);

    const send = async (q: string, vars: Record<string, any>, field: string): Promise<Cart> => {
        const data = await gql(q, vars);
        const next = parse(data?.mongo?.[field]);
        setCart(next);
        return next;
    };

    const addItem = useCallback((productId: string, sku: string, qty = 1) =>
        send(ADD, {pid: productId, sku, qty}, 'cartAddItem'), []);
    const updateQty = useCallback((productId: string, sku: string, qty: number) =>
        send(UPD, {pid: productId, sku, qty}, 'cartUpdateQty'), []);
    const removeItem = useCallback((productId: string, sku: string) =>
        send(REM, {pid: productId, sku}, 'cartRemoveItem'), []);
    const clear = useCallback(() => send(CLR, {}, 'cartClear'), []);

    return {cart, loading, refresh, addItem, updateQty, removeItem, clear};
}
