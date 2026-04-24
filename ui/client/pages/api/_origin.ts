import type {NextApiRequest, NextApiResponse} from 'next';

/**
 * Same-origin check for destructive POSTs. Rejects requests whose `Origin`
 * (or `Referer`) host doesn't match the request's own Host — blocks cross-
 * origin form/fetch-based CSRF. NextAuth already issues its own CSRF token
 * for signin routes; this is the catch-all for our custom POST endpoints.
 */
export function requireSameOrigin(req: NextApiRequest, res: NextApiResponse): boolean {
    const host = req.headers.host;
    if (!host) {
        res.status(400).json({error: 'Missing Host header'});
        return false;
    }
    const origin = req.headers.origin ?? '';
    const referer = req.headers.referer ?? '';
    const hostMatches = (url: string) => {
        try {
            return new URL(url).host === host;
        } catch {
            return false;
        }
    };
    if (origin && !hostMatches(origin)) {
        res.status(403).json({error: 'Cross-origin request blocked'});
        return false;
    }
    if (!origin && referer && !hostMatches(referer)) {
        res.status(403).json({error: 'Cross-origin referer blocked'});
        return false;
    }
    if (!origin && !referer) {
        res.status(403).json({error: 'Missing Origin and Referer headers'});
        return false;
    }
    return true;
}
