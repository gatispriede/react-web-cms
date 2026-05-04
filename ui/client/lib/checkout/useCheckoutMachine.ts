import {useCallback, useEffect, useState} from 'react';

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

export function useCheckoutMachine() {
    const [state, setState] = useState<CheckoutState>(() => readState());

    useEffect(() => { writeState(state); }, [state]);

    const setOrderId = useCallback((orderId: string | undefined) => {
        setState(s => ({...s, orderId}));
    }, []);

    const goTo = useCallback((step: CheckoutStep) => {
        setState(s => ({...s, step}));
    }, []);

    const reset = useCallback(() => {
        setState({step: 'cart'});
        if (typeof window !== 'undefined') {
            try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* noop */ }
        }
    }, []);

    return {orderId: state.orderId, step: state.step, setOrderId, goTo, reset};
}
