/**
 * `/checkout/confirmation/[id]` — App Router migration, Batch 5.
 *
 * Server-Component port of the former
 * `pages/checkout/confirmation/[id].tsx`. Pure thin loader — the
 * `OrderSummary` + `MagicLinkAccountUpgrade` + `ReferAFriendCta` /
 * `SocialShareButtons` modules under `checkout-confirmation` own the
 * confirmation-screen UX. Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import ConfirmationView from './ConfirmationView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {title: 'Order confirmation'};

export default async function CheckoutConfirmationPage(): Promise<React.ReactElement> {
    const systemPage = loadSystemPageSnapshot('checkout-confirmation');
    return <ConfirmationView systemPage={systemPage}/>;
}
