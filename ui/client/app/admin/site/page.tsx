/**
 * `/admin/site` — admin-information-architecture jump.
 * Area landing: bounces to themes (most-used Site pane).
 */
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';

export const dynamic = 'force-dynamic';

export default async function AdminSitePage(): Promise<never> {
    // Per-area sweep landing target — points at the Footer demonstrator
    // (which has both a new URL + the new shared chrome). Updates to
    // `/admin/site/themes` etc. when that bucket's sweep lands.
    await resolveAdminSession({redirectTo: '/admin/site/footer'});
    throw new Error('unreachable');
}
