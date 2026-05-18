/**
 * `/admin/client-config` — App Router migration, Batch 6.
 * Area landing: bounces to the first sub-page (`themes`). Mirrors the
 * Pages-Router `buildAdminSsr({redirectTo: '/admin/client-config/themes'})`.
 */
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';

export const dynamic = 'force-dynamic';

export default async function AdminClientConfigPage(): Promise<never> {
    await resolveAdminSession({redirectTo: '/admin/client-config/themes'});
    // Unreachable — resolveAdminSession throws redirect().
    throw new Error('unreachable');
}
