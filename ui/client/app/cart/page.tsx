/**
 * `/cart` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/cart/index.tsx`. The
 * Amazon-style 2-column layout (CartLineItems + CartSummary) is
 * hand-rolled — operators don't get to recompose this page through
 * SystemPageDispatch, the rails are fixed. The system-page snapshot
 * is still loaded so the section registry stays intact for later, but
 * the page renders the locked modules directly.
 *
 * Feature gate: the former `gatePath('/cart')` wrapper is replaced by
 * a direct `isFeatureEnabled('cart')` check + `notFound()` — the
 * App-Router idiom.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {gateForPath} from '@client/lib/loaders/applyPublicGates';
import {isFeatureEnabled} from '@services/infra/featureFlags';
import CartView from './CartView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Shopping Basket'};

export default async function CartPage(): Promise<React.ReactElement> {
    const featureId = gateForPath('/cart');
    if (featureId && !isFeatureEnabled(featureId)) notFound();
    return <CartView/>;
}
