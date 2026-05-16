/** `/admin/settings/access/users` — admin-information-architecture re-pivot
 *  (2026-05-16, same day as first ship). Admin-only. Moved from
 *  `/admin/people/users`; old URLs (`/admin/system/users`,
 *  `/admin/people/users`) 301 here. */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from '../../../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · Users', robots: {index: false, follow: false}};

export default async function Page(): Promise<React.ReactElement> {
    const session = await resolveAdminSession({adminOnly: true});
    return <AdminShell session={session} view="settings/access/users"/>;
}
