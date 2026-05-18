/**
 * `/account/signin` — App Router migration, Batch 6.
 *
 * Server-Component port of `pages/account/signin.tsx`. Pulls the
 * `account-signin` system-page snapshot, runs the SiteFlags `auth`
 * gate (hard 404 when `clientLoginEnabled === false` — belt-and-braces
 * behind the edge middleware), and hands off to the `'use client'`
 * view. The locked `SigninForm` smart-wrapper module
 * (`_AccountPageModules/authWrappers.tsx`) — already on `next/navigation`
 * since B4.5 — does the actual sign-in handshake.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SigninView from './SigninView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Sign in', robots: {index: false, follow: false}};

export default async function SigninPage(): Promise<React.ReactElement> {
    let clientLoginEnabled = true;
    try {
        const auth = (await getMongoConnection().siteFlagsService.get()).auth ?? {};
        clientLoginEnabled = (auth as {clientLoginEnabled?: boolean}).clientLoginEnabled !== false;
    } catch { /* flag service unavailable — keep the route reachable */ }
    if (!clientLoginEnabled) notFound();
    const systemPage = loadSystemPageSnapshot('account-signin');
    return <SigninView systemPage={systemPage}/>;
}
