/**
 * `/account/verify` — App Router migration, Batch 6 (W6c).
 *
 * Server-Component port of `pages/account/verify.tsx`. Reads the
 * `?token=` and `?callbackUrl=` query params from `searchParams` (the
 * App-Router `Promise` form) and hands them to the `'use client'` view
 * that drives NextAuth's `signIn('customer-magic', …)` on explicit user
 * click. The defeat-pre-fetch contract (token consumed only on POST,
 * never on GET/HEAD) is preserved — the server-component does NOT call
 * `signIn` itself.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import VerifyView from './VerifyView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Confirm sign-in', robots: {index: false, follow: false}};

export default async function VerifyPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
    const sp = await searchParams;
    const tokenRaw = Array.isArray(sp.token) ? sp.token[0] : sp.token;
    const cbRaw = Array.isArray(sp.callbackUrl) ? sp.callbackUrl[0] : sp.callbackUrl;
    const token = typeof tokenRaw === 'string' ? tokenRaw : null;
    const callbackUrl = typeof cbRaw === 'string' ? cbRaw : '/account';
    return <VerifyView token={token} callbackUrl={callbackUrl}/>;
}
