import {getServerSession} from 'next-auth/next';
import {redirect} from 'next/navigation';
import type {Session} from 'next-auth';
import {adminAuthOptions} from '../pages/api/auth/authOptions';

/**
 * App-Router twin of `buildAdminSsr` (`./adminSsr.ts`).
 *
 * The Pages-Router helper returns a `GetServerSideProps`; the App-Router
 * surface has no such hook, so this function is intended to be `await`ed
 * at the top of a Server Component `page.tsx`. The contract mirrors the
 * Pages-Router version 1:1:
 *
 *  - When `redirectTo` is set, jump straight there. Used by area-landing
 *    pages (`/admin/build`, `/admin/content/…`) that bounce to their
 *    first sub-page.
 *  - Otherwise resolve the admin NextAuth session (the `/api/admin/auth/*`
 *    instance — NOT the customer one) and hand it back JSON-cloned so the
 *    Server Component can seed the client `<SessionProvider>`.
 *  - With `adminOnly: true`, non-admins (editors) get a soft redirect to
 *    `/admin/build` — same gate matrix the Pages-Router helper enforces.
 *
 * Returns the cloned session (or `null` if not signed in). On a redirect
 * the function `throw`s `redirect(…)` and never returns — App-Router
 * idiom; the caller doesn't see control again.
 */
export async function resolveAdminSession(opts: {adminOnly?: boolean; redirectTo?: string} = {}): Promise<Session | null> {
    if (opts.redirectTo) {
        redirect(opts.redirectTo);
    }
    const raw = await getServerSession(adminAuthOptions);
    const session = raw ? (JSON.parse(JSON.stringify(raw)) as Session) : null;
    if (opts.adminOnly && session) {
        const role = (session.user as {role?: string} | undefined)?.role;
        if (role !== 'admin') {
            redirect('/admin/build');
        }
    }
    return session;
}
