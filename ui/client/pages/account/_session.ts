import type {GetServerSidePropsContext} from 'next';
import {getServerSession} from 'next-auth/next';
import {authOptions} from '../api/auth/[...nextauth]';

/**
 * Server-side guard for `/account/*` pages — parallels the admin
 * `withAdminSession` pattern. Anything that isn't a customer cookie
 * (anon, admin, error) bounces to `/account/signin`. Admins explicitly
 * cannot enter the customer surface — they're a different population.
 */
export async function requireCustomerSession(ctx: GetServerSidePropsContext) {
    const raw = await getServerSession(ctx.req, ctx.res, authOptions);
    const user = (raw?.user as any) ?? null;
    if (!user || user.kind !== 'customer') {
        return {
            ok: false as const,
            redirect: {
                destination: '/account/signin?callbackUrl=' + encodeURIComponent(ctx.resolvedUrl ?? '/account'),
                permanent: false,
            },
        };
    }
    return {ok: true as const, session: raw ? JSON.parse(JSON.stringify(raw)) : null};
}
