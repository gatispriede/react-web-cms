/**
 * `/checkout/address` — App Router migration, Batch 5.
 *
 * Server-Component port of the former `pages/checkout/address.tsx`. Pure
 * thin loader: pulls the `checkout-address` system-page snapshot and
 * hands it to the `'use client'` view, which carries the antd
 * `ConfigProvider` + `CheckoutShell` + `<SystemPageDispatch>` call.
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import AddressStepView from './AddressStepView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Shipping address'};

export default async function CheckoutAddressPage(): Promise<React.ReactElement> {
    const systemPage = loadSystemPageSnapshot('checkout-address');
    return <AddressStepView systemPage={systemPage}/>;
}
