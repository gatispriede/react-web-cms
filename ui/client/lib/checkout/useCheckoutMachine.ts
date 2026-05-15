import {useCallback, useEffect, useState} from 'react';
import {useRouter} from 'next/router';

/**
 * Tiny step-state hook for the checkout flow. Persists `orderId` plus
 * the current step to localStorage so a mid-flow reload resumes where
 * the customer left off. No XState dep — the surface area is small
 * enough that a hand-rolled reducer pulls its weight.
 */

export type CheckoutStep = 'cart' | 'address' | 'shipping' | 'payment' | 'review' | 'confirmation';

interface CheckoutState {
    orderId?: string;
    step: CheckoutStep;
}

const STORAGE_KEY = 'checkout.machine.v1';

const readState = (): CheckoutState => {
    if (typeof window === 'undefined') return {step: 'cart'};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {step: 'cart'};
        const parsed = JSON.parse(raw) as CheckoutState;
        if (!parsed || typeof parsed !== 'object') return {step: 'cart'};
        return {orderId: parsed.orderId, step: parsed.step ?? 'cart'};
    } catch {
        return {step: 'cart'};
    }
};

const writeState = (state: CheckoutState) => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota / private mode */ }
};

/** Map each step to the file-system route that renders it. Drives
 *  `goTo()`'s router push. Kept in sync with `ui/client/pages/checkout/*`. */
const STEP_ROUTES: Record<CheckoutStep, string> = {
    cart: '/cart',
    address: '/checkout/address',
    shipping: '/checkout/shipping',
    payment: '/checkout/payment',
    review: '/checkout/payment',          // no /review route today — payment is the review surface
    confirmation: '/checkout/confirmation',
};

export function useCheckoutMachine() {
    const [state, setState] = useState<CheckoutState>(() => readState());
    const router = useRouter();

    useEffect(() => { writeState(state); }, [state]);

    const setOrderId = useCallback((orderId: string | undefined) => {
        setState(s => ({...s, orderId}));
    }, []);

    const goTo = useCallback((step: CheckoutStep) => {
        setState(s => ({...s, step}));
        // Each step is a separate Next.js file-system route — updating
        // local state alone left the user staring at the same page. Push
        // through the router so the next step actually mounts. Best-effort:
        // SSR contexts (no `window`) skip the push; the LS-persisted state
        // takes over on rehydrate.
        if (typeof window !== 'undefined') {
            const target = STEP_ROUTES[step];
            if (target && router.asPath !== target) {
                void router.push(target);
            }
        }
    }, [router]);

    const reset = useCallback(() => {
        setState({step: 'cart'});
        if (typeof window !== 'undefined') {
            try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
        }
    }, []);

    return {orderId: state.orderId, step: state.step, setOrderId, goTo, reset};
}
