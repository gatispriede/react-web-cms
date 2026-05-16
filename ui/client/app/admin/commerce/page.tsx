/**
 * `/admin/commerce` — admin-information-architecture jump.
 * Area landing: bounces to products (most-used Commerce pane).
 */
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';

export const dynamic = 'force-dynamic';

export default async function AdminCommercePage(): Promise<never> {
    // Points at the Invoices demonstrator (new URL + new chrome).
    // Updates to `/admin/commerce/products` when that bucket's sweep lands.
    await resolveAdminSession({redirectTo: '/admin/commerce/invoices'});
    throw new Error('unreachable');
}
