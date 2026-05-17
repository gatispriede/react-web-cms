/**
 * `/account/verify` — module-compose pass 2026-05-17.
 *
 * Previously read `?token=` + `?callbackUrl=` server-side and passed
 * them as props to a bespoke VerifyView. The defeat-pre-fetch contract
 * (token consumed only on user click, never on email-client GET/HEAD
 * pre-fetch) is preserved: the smart wrapper reads search params via
 * `useSearchParams()` and only calls `signIn('customer-magic', …)` from
 * an explicit `onClick`. No server-side token consumption — the page
 * just loads the system-page snapshot.
 */
import React from 'react';
import type {Metadata} from 'next';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import VerifyView from './VerifyView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Confirm sign-in', robots: {index: false, follow: false}};

export default async function VerifyPage(): Promise<React.ReactElement> {
    const systemPage = loadSystemPageSnapshot('account-verify');
    return <VerifyView systemPage={systemPage}/>;
}
