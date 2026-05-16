/** `/admin/analytics` — admin-information-architecture jump. Admin-only.
 *  Moved from `/admin/seo/analytics` per the new taxonomy; old URL 301s via next.config.js.
 *  Becomes the Analytics bucket landing page. */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from '../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · Analytics', robots: {index: false, follow: false}};

export default async function Page(): Promise<React.ReactElement> {
    const session = await resolveAdminSession({adminOnly: true});
    return <AdminShell session={session} view="analytics"/>;
}
