/**
 * `/admin/content` — App Router migration, Batch 6.
 * Area landing: bounces to translations.
 */
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';

export const dynamic = 'force-dynamic';

export default async function AdminContentPage(): Promise<never> {
    await resolveAdminSession({redirectTo: '/admin/content/translations'});
    throw new Error('unreachable');
}
