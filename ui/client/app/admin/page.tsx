/**
 * `/admin` — App Router migration, Batch 6.
 *
 * Server-Component port of `pages/admin.tsx`. SSR-resolves the admin
 * NextAuth session via `resolveAdminSession()` and hands it to the
 * `'use client'` admin shell. The Pages-Router version returned the
 * session through gSSP props; under App Router we pass it as a prop to
 * the shell directly so the inner `<SessionProvider basePath="…">`
 * seeds without flicker (risk-map #9).
 *
 * Pages-Router file deleted in the same commit (`app/admin/page.tsx`
 * collides with `pages/admin.tsx` — hard Next error if both exist).
 */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from './AdminShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Admin',
    robots: {index: false, follow: false},
};

export default async function AdminPage(): Promise<React.ReactElement> {
    const session = await resolveAdminSession();
    return <AdminShell session={session}/>;
}
