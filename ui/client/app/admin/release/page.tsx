/**
 * `/admin/release` — App Router migration, Batch 6.
 * Area landing: bounces to publishing.
 */
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';

export const dynamic = 'force-dynamic';

export default async function AdminReleasePage(): Promise<never> {
    await resolveAdminSession({redirectTo: '/admin/release/publishing'});
    throw new Error('unreachable');
}
