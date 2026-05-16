/**
 * `/auth/signin` — App Router migration, Batch 6.
 *
 * Server-Component port of `pages/auth/signin.tsx`. Legacy pre-auth-split
 * sign-in route — kept for backward compatibility (the `next-auth/react`
 * default base path is `/api/auth/*`, so any `signIn()` call without
 * `basePath` lands here on the customer NextAuth instance). Operators
 * use `/admin/signin` now; this surface exists only because old admin
 * bookmarks + the customer NextAuth `pages.signIn` config still point
 * at it (see `auth-roles.md`).
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import SignInLegacyView from './SignInLegacyView';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Sign in', robots: {index: false, follow: false}};

export default async function SignInLegacyPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
    const sp = await searchParams;
    const cbRaw = Array.isArray(sp.callbackUrl) ? sp.callbackUrl[0] : sp.callbackUrl;
    const callbackUrl = typeof cbRaw === 'string' ? cbRaw : '/admin';
    return <SignInLegacyView callbackUrl={callbackUrl}/>;
}
