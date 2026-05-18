/**
 * `/admin/seo` — App Router migration, Batch 6.
 * No redirectTo — the SEO area renders a single landing (no sub-pages today).
 */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from '../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · SEO', robots: {index: false, follow: false}};

export default async function AdminSeoPage(): Promise<React.ReactElement> {
    const session = await resolveAdminSession();
    return <AdminShell session={session} view="seo"/>;
}
