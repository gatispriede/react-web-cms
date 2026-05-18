/**
 * Tiny client-side cart hook.
 *
 * Wraps the GraphQL queries/mutations for the cart with optimistic
 * local state. Mutations send via the customer pages' `gql()` helper
 * (same path used by /account/*) — the cart cookie is sent same-origin
 * automatically by `credentials: 'same-origin'` in `gqlClient.ts`.
 *
 * Cross-component sync: every `useCart()` consumer subscribes to a
 * single module-level store via `useSyncExternalStore`. `addItem` from
 * the product detail page immediately updates the header `CartIcon`'s
 * badge count — no full-page refresh required, no React Context
 * provider needed at the root.
 */
import {useCallback, useEffect, useSyncExternalStore} from 'react';
import {gql} from '@client/lib/account/gqlClient';
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

// ── Module-level singleton store ────────────────────────────────────
// All `useCart()` consumers read from the same `state` ref and
// subscribe to the same listener set. Mutating the store via `setState`
// fans the new snapshot out to every subscribed component in one tick.
//
// Why not React Context: the storefront `_app.tsx` doesn't wrap the
// public-site tree in a `<CartProvider>` today (and adding it touches
// every page). A module-level store keeps the wiring identical to
// the previous useState-based hook from the consumer's POV.
let state: Cart = EMPTY;
let loaded = false;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: Cart): void {
    state = next;
    listeners.forEach(l => l());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

function getSnapshot(): Cart { return state; }
function getServerSnapshot(): Cart { return EMPTY; }

async function refreshShared(): Promise<void> {
    if (inflight) return inflight;
    inflight = (async () => {
        try {
            const data = await gql(CART_QUERY);
            setState(parse(data?.mongo?.cart));
        } catch {
            // network blip — keep last-known state
        } finally {
            loaded = true;
            inflight = null;
        }
    })();
    return inflight;
}

async function send(q: string, vars: Record<string, any>, field: string): Promise<Cart> {
    const data = await gql(q, vars);
    const next = parse(data?.mongo?.[field]);
    setState(next);
    return next;
}

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
    const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    // First mount in the page kicks the shared fetch. Subsequent
    // consumers see the same in-flight promise via `refreshShared`'s
    // inflight guard, so we don't spam `/api/graphql` with parallel
    // identical reads.
    useEffect(() => { if (!loaded) void refreshShared(); }, []);

    const refresh = useCallback(() => refreshShared(), []);
    const addItem = useCallback((productId: string, sku: string, qty = 1) =>
        send(ADD, {pid: productId, sku, qty}, 'cartAddItem'), []);
    const updateQty = useCallback((productId: string, sku: string, qty: number) =>
        send(UPD, {pid: productId, sku, qty}, 'cartUpdateQty'), []);
    const removeItem = useCallback((productId: string, sku: string) =>
        send(REM, {pid: productId, sku}, 'cartRemoveItem'), []);
    const clear = useCallback(() => send(CLR, {}, 'cartClear'), []);

    return {cart, loading: !loaded, refresh, addItem, updateQty, removeItem, clear};
}
