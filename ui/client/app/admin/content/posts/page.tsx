/** `/admin/content/posts` — App Router migration, Batch 6. */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from '../../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · Posts', robots: {index: false, follow: false}};

export default async function Page(): Promise<React.ReactElement> {
    const session = await resolveAdminSession();
    return <AdminShell session={session} view="content/posts"/>;
}
