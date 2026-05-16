/**
 * `/admin/modules-preview` — App Router migration, Batch 6.
 * Server-Component port of `pages/admin/modules-preview.tsx`.
 */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from '../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · Modules preview', robots: {index: false, follow: false}};

export default async function AdminModulesPreviewPage(): Promise<React.ReactElement> {
    const session = await resolveAdminSession();
    return <AdminShell session={session} view="modules-preview" seoTitle="Admin · Modules preview"/>;
}
