/** `/admin/settings/chrome/footer` — admin-information-architecture re-pivot
 *  (2026-05-16, same day as first ship). Moved from `/admin/site/footer`;
 *  old URLs (`/admin/content/footer`, `/admin/site/footer`) 301 here. */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from '../../../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · Footer', robots: {index: false, follow: false}};

export default async function Page(): Promise<React.ReactElement> {
    const session = await resolveAdminSession();
    return <AdminShell session={session} view="settings/chrome/footer"/>;
}
