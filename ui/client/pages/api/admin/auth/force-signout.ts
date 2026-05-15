import type {NextApiRequest, NextApiResponse} from 'next';

/**
 * Hard-purge the admin session cookie.
 *
 * Why this exists separately from NextAuth's built-in `/signout`:
 *   - NextAuth only clears the cookie at the path it currently has in
 *     `cookies.sessionToken.options.path`. We changed that path from
 *     `/admin` → `/` mid-flight (see authOptions.ts), so any operator
 *     who signed in before that fix has TWO cookies in their browser
 *     with the same name `cms.admin-session` but different paths.
 *     The standard signout clears one; the other keeps the operator
 *     logged in.
 *
 * Strategy: emit `Set-Cookie` headers with `Max-Age=0` for every path
 * the cookie could plausibly live at. Browsers treat (name, path,
 * domain) as the cookie identity, so each Set-Cookie targets a
 * specific stale variant.
 */
const COOKIE_NAME = 'cms.admin-session';
const PATHS = ['/', '/admin', '/api', '/api/admin', '/api/admin/auth'];

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
    const expires = new Date(0).toUTCString();
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const cookies = PATHS.flatMap(p => [
        `${COOKIE_NAME}=; Path=${p}; Expires=${expires}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
        // Also the next-auth CSRF + callback cookies for the admin instance
        `__Host-next-auth.csrf-token=; Path=${p}; Expires=${expires}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
        `next-auth.csrf-token=; Path=${p}; Expires=${expires}; Max-Age=0; HttpOnly; SameSite=Lax${secure}`,
        `next-auth.callback-url=; Path=${p}; Expires=${expires}; Max-Age=0; SameSite=Lax${secure}`,
    ]);
    res.setHeader('Set-Cookie', cookies);
    res.status(200).json({ok: true});
}
