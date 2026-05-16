/**
 * `/admin/people` — admin-information-architecture jump.
 * Area landing: bounces to users (most-used People pane).
 */
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';

export const dynamic = 'force-dynamic';

export default async function AdminPeoplePage(): Promise<never> {
    await resolveAdminSession({redirectTo: '/admin/people/users'});
    throw new Error('unreachable');
}
