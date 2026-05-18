/**
 * `/admin/settings` — admin-information-architecture re-pivot landing.
 *
 * Was previously the Pages-router-era "Settings" pane (a flat list of
 * settings); the 6-bucket IA jump 301-redirected it to `/admin/build`.
 * The 5-bucket re-pivot makes Settings a top-level bucket — landing
 * bounces to the Footer demonstrator (new URL + new chrome). Updates
 * to a dedicated Settings overview pane when one of the per-area sweeps
 * lands.
 */
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage(): Promise<never> {
    await resolveAdminSession({redirectTo: '/admin/settings/chrome/footer'});
    throw new Error('unreachable');
}
