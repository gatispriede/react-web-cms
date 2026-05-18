/**
 * `/checkout` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/checkout/index.tsx`.
 * Reads `commerce.checkout.flow` from `getSiteFlags()`:
 *   - `multi-step` → server-side `redirect('/checkout/address')`
 *     (the multi-step entry point);
 *   - `single-step` (default) → loads the `checkout` system-page
 *     snapshot + the enabled provider list and renders the
 *     `'use client'` SingleStepCheckoutView.
 *
 * The Pages-Router page used `gatePath('/checkout', …)` for the
 * feature-flag wrapper; here we call `isFeatureEnabled()` directly and
 * `notFound()` if the gate is off — same outcome, App-Router idiom.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {notFound, redirect} from 'next/navigation';
import {gateForPath} from '@client/lib/loaders/applyPublicGates';
import {isFeatureEnabled} from '@services/infra/featureFlags';
import {loadSystemPageSnapshot, type ISystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import SingleStepCheckoutView from './SingleStepCheckoutView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Checkout'};

type CheckoutFlow = 'single-step' | 'multi-step';

interface CheckoutFlagState {
    flow: CheckoutFlow;
    providers: Array<{id: string; displayName: string}>;
}

async function loadCheckoutFlags(): Promise<CheckoutFlagState> {
    let flow: CheckoutFlow = 'single-step';
    let providerFlags: Record<string, boolean> = {};
    try {
        const raw = await getMongoConnection().getSiteFlags();
        const flags = JSON.parse(raw);
        const co = (flags?.commerce?.checkout ?? {}) as Record<string, unknown>;
        if (co.flow === 'multi-step') flow = 'multi-step';
        providerFlags = ((co.providers as Record<string, boolean>) ?? {});
    } catch {
        // fall through to defaults
    }
    const providers: Array<{id: string; displayName: string}> = [];
    if (providerFlags.stripe !== false && process.env.STRIPE_SECRET_KEY) {
        providers.push({id: 'stripe', displayName: 'Credit / debit card'});
    }
    if (providerFlags.bankTransfer !== false) {
        providers.push({id: 'bankTransfer', displayName: 'Bank transfer'});
    }
    if (providerFlags.cashOnDelivery !== false) {
        providers.push({id: 'cashOnDelivery', displayName: 'Cash on delivery'});
    }
    return {flow, providers};
}

export default async function CheckoutIndexPage(): Promise<React.ReactElement> {
    const featureId = gateForPath('/checkout');
    if (featureId && !isFeatureEnabled(featureId)) notFound();

    const {flow, providers} = await loadCheckoutFlags();
    if (flow === 'multi-step') redirect('/checkout/address');

    const systemPage = loadSystemPageSnapshot('checkout');
    // `systemPage` is loaded but not used by the single-step view (the
    // hand-rolled layout owns the rails) — pass-through preserves the
    // Pages-Router contract for future composability.
    void systemPage;
    return <SingleStepCheckoutView providers={providers}/>;
}
