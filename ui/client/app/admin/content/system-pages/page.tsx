/** `/admin/content/system-pages` — admin-information-architecture jump.
 *  System-pages pane (framework-required pages registry) gets its App
 *  Router entrypoint as part of the IA sweep. */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from '../../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · System pages', robots: {index: false, follow: false}};

export default async function Page(): Promise<React.ReactElement> {
    const session = await resolveAdminSession({adminOnly: true});
    return <AdminShell session={session} view="content/system-pages"/>;
}
