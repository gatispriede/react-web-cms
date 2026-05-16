/**
 * `/admin/settings` — App Router migration, Batch 6.
 * Server-Component port of `pages/admin/settings.tsx`. Same SSR session
 * pattern as `/admin` — see `app/admin/page.tsx` for the rationale.
 */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from '../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · Settings', robots: {index: false, follow: false}};

export default async function AdminSettingsPage(): Promise<React.ReactElement> {
    const session = await resolveAdminSession();
    return <AdminShell session={session} view="settings"/>;
}
