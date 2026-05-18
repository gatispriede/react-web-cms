/**
 * `/checkout/payment` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/checkout/payment.tsx`.
 * Pure thin loader: pulls the `checkout-payment` system-page snapshot
 * and hands it to the `'use client'` view. Pages-Router file deleted
 * in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import PaymentStepView from './PaymentStepView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Payment'};

export default async function CheckoutPaymentPage(): Promise<React.ReactElement> {
    const systemPage = loadSystemPageSnapshot('checkout-payment');
    return <PaymentStepView systemPage={systemPage}/>;
}
