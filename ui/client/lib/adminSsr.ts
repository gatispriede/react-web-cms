import type {GetServerSideProps, GetServerSidePropsContext} from 'next';
import {getServerSession} from 'next-auth/next';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
// Use the ADMIN NextAuth options — admin pages have admin-session cookies
// (Path=/admin), and getServerSession() needs the matching options to
// recognise them. Importing the customer-default `authOptions` from
// `pages/api/auth/[...nextauth]` would silently read null sessions on
// every admin page and force a re-login loop.
import {adminAuthOptions as authOptions} from '../pages/api/auth/authOptions';

/**
 * Shared SSR loader for admin pages (Phase 2 of admin segregation —
 * docs/features/platform/admin-segregation.md).
 *
 * `adminOnly: true` redirects non-admins to `/admin/build` — used by
 * `/admin/system/*` per the spec's permission-gate matrix. Editors landing
 * there see the same redirect-to-Build behaviour `/account/*` gives admins
 * (different population, wrong door).
 */
export const buildAdminSsr = (opts: {adminOnly?: boolean; redirectTo?: string} = {}): GetServerSideProps =>
    async ({req, res, locale}: GetServerSidePropsContext) => {
        // Area landings (`/admin/<area>` with no sub-path) jump straight to
        // their first sub-page — the user's "default to subpages, first one
        // in list" rule. Caller passes `redirectTo`.
        if (opts.redirectTo) {
            return {redirect: {destination: opts.redirectTo, permanent: false}};
        }
        const raw = await getServerSession(req, res, authOptions);
        const session = raw ? JSON.parse(JSON.stringify(raw)) : null;
        if (opts.adminOnly && session) {
            const role = (session.user as any)?.role;
            if (role !== 'admin') {
                return {redirect: {destination: '/admin/build', permanent: false}};
            }
        }
        return {
            props: {
                session,
                ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
            },
        };
    };
