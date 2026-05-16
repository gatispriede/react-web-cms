/** `/admin/commerce/invoices` — admin-information-architecture jump.
 *  Invoices pane landed earlier at this URL (per `invoicing-and-bookkeeping`)
 *  but had no App Router entrypoint until the IA jump. */
import React from 'react';
import type {Metadata} from 'next';
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';
import AdminShell from '../../AdminShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {title: 'Admin · Invoices', robots: {index: false, follow: false}};

export default async function Page(): Promise<React.ReactElement> {
    const session = await resolveAdminSession({adminOnly: true});
    return <AdminShell session={session} view="commerce/invoices"/>;
}
