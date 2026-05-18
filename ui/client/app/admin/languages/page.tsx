/**
 * `/admin/languages` — App Router migration, Batch 6.
 * Server-Component port of `pages/admin/languages.tsx`.
 */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from '../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · Languages', robots: {index: false, follow: false}};

export default async function AdminLanguagesPage(): Promise<React.ReactElement> {
    const session = await resolveAdminSession();
    return <AdminShell session={session} view="languages"/>;
}
