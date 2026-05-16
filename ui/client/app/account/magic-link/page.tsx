/**
 * `/account/magic-link` — App Router migration, Batch 6.
 * Server-Component port of `pages/account/magic-link.tsx`. The locked
 * `MagicLinkRequestForm` module POSTs `/api/auth/magic-request` from
 * the client. Response is intentionally opaque — same "check your
 * inbox" copy whether or not the email exists.
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import {loadSystemPageSnapshot} from '@client/lib/systemPage/loadSystemPage';
import MagicLinkView from './MagicLinkView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Sign in with a magic link', robots: {index: false, follow: false}};

export default async function MagicLinkPage(): Promise<React.ReactElement> {
    const systemPage = loadSystemPageSnapshot('account-magic-link');
    return <MagicLinkView systemPage={systemPage}/>;
}
