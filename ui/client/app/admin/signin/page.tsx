/**
 * `/admin/signin` — App Router migration, Batch 6.
 *
 * Server-Component port of `pages/admin/signin.tsx`. Reads the optional
 * `?returnTo=` from `searchParams` (App-Router `Promise` form) and the
 * `AUTH_GOOGLE_*` env at request time, then renders the `'use client'`
 * form. The credentials handshake (CSRF fetch → form POST against
 * `/api/admin/auth/callback/admin-credentials`) is unchanged — it
 * already targeted the admin NextAuth instance manually because
 * `next-auth/react`'s `signIn()` would otherwise hit the customer
 * default base path (auth-split Phase 1.A).
 *
 * Pages-Router file deleted in the same commit.
 */
import React from 'react';
import type {Metadata} from 'next';
import AdminSignInView from './AdminSignInView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Admin sign in',
    robots: {index: false, follow: false},
};

export default async function AdminSignInPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<React.ReactElement> {
    const sp = await searchParams;
    const raw = Array.isArray(sp.returnTo) ? sp.returnTo[0] : sp.returnTo;
    const returnTo = typeof raw === 'string' && raw.startsWith('/') ? raw : '/admin';
    const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
    return <AdminSignInView returnTo={returnTo} googleEnabled={googleEnabled}/>;
}
