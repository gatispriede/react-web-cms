/**
 * `/admin/system` — App Router migration, Batch 6.
 * Area landing: bounces to users. Admin-only; non-admins get the
 * `/admin/build` soft-redirect baked into `resolveAdminSession`.
 *
 * Order of operations is identical to the Pages-Router helper: the
 * `redirectTo` short-circuit fires unconditionally because the area
 * landing is always a bounce — never reaches the session check. The
 * editor-vs-admin gate kicks in once an editor navigates to a real
 * sub-page like `/admin/system/users` (those carry `adminOnly: true`).
 */
import {resolveAdminSession} from '@client/lib/adminSsrAppRouter';

export const dynamic = 'force-dynamic';

export default async function AdminSystemPage(): Promise<never> {
    // Post admin-information-architecture jump: System bucket is dev/power-user
    // surfaces only. Bounce to MCP (most-used system pane).
    await resolveAdminSession({redirectTo: '/admin/system/mcp'});
    throw new Error('unreachable');
}
