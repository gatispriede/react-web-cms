/** `/admin/people/users` — admin-information-architecture jump. Admin-only.
 *  Moved from `/admin/system/users` per the new taxonomy; old URL 301s via next.config.js. */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from '../../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · Users', robots: {index: false, follow: false}};

export default async function Page(): Promise<React.ReactElement> {
    const session = await resolveAdminSession({adminOnly: true});
    return <AdminShell session={session} view="people/users"/>;
}
