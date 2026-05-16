import type {GetServerSidePropsContext} from 'next';
import {getServerSession} from 'next-auth/next';
import {redirect} from 'next/navigation';
import {authOptions} from '@client/pages/api/auth/[...nextauth]';

/**
 * Server-side guard for `/account/*` Pages-Router pages — parallels the
 * admin `withAdminSession` pattern. Anything that isn't a customer
 * cookie (anon, admin, error) bounces to `/account/signin`. Admins
 * explicitly cannot enter the customer surface — they're a different
 * population.
 *
 * App-Router callers should use `requireCustomerSessionAppRouter()`
 * instead — it `throw`s a `redirect()` (the App-Router idiom) rather
 * than returning a Next-typed `{redirect}` object that only the
 * Pages-Router `getServerSideProps` runtime knows how to act on.
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

/**
 * App-Router variant of `requireCustomerSession`. Call from a Server
 * Component or Route Handler. On no-customer-session the function
 * `throw`s `redirect('/account/signin?callbackUrl=…')` — control never
 * returns to the caller. On success it returns the JSON-cloned session
 * (same shape the Pages-Router helper returns).
 *
 *   const session = await requireCustomerSessionAppRouter('/account');
 *   // ↑ unreachable past this line on non-customer sessions
 *
 * Pass the page's own URL path as `callbackUrl` so signin can bounce
 * back. Pages-Router callers should keep using `requireCustomerSession`.
 */
export async function requireCustomerSessionAppRouter(callbackUrl: string): Promise<unknown> {
    const raw = await getServerSession(authOptions);
    const user = (raw?.user as any) ?? null;
    if (!user || user.kind !== 'customer') {
        redirect('/account/signin?callbackUrl=' + encodeURIComponent(callbackUrl));
    }
    return raw ? JSON.parse(JSON.stringify(raw)) : null;
}
