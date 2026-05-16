/**
 * `/account/signup` — App Router migration, Batch 6.
 * Server-Component port of `pages/account/signup.tsx`. The locked
 * `SignupForm` smart-wrapper module (carries B2B capture + magic-link
 * / password / OAuth toggles) does the actual signup handshake.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import SignupView from './SignupView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Create your account', robots: {index: false, follow: false}};

export default async function SignupPage(): Promise<React.ReactElement> {
    const systemPage = loadSystemPageSnapshot('account-signup');
    return <SignupView systemPage={systemPage}/>;
}
