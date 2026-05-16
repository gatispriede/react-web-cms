/**
 * `/checkout/shipping` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/checkout/shipping.tsx`.
 * Pure thin loader: pulls the `checkout-shipping` system-page snapshot
 * and hands it to the `'use client'` view. Pages-Router file deleted
 * in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import ShippingStepView from './ShippingStepView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Shipping method'};

export default async function CheckoutShippingPage(): Promise<React.ReactElement> {
    const systemPage = loadSystemPageSnapshot('checkout-shipping');
    return <ShippingStepView systemPage={systemPage}/>;
}
