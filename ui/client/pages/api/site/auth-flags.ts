import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

/**
 * Lightweight read-only endpoint for the auth-flag namespace. Used by
 * the edge middleware to gate `/account/*` on
 * `siteFlags.auth.clientLoginEnabled` without dragging the full
 * `siteFlags.get()` payload to the edge each request.
 *
 * Response is intentionally minimal — every field returned here is
 * `audience: 'public-readable'` per the `defineFlag()` registrations
 * in `services/features/Auth/authFlags.ts`. Operator-only flags
 * never appear here.
 *
 * `Cache-Control: public, max-age=30` mirrors the in-process cache
 * in the middleware so a manual `curl` from the browser behaves like
 * the edge.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({error: 'Method not allowed'});
    }
    try {
        const flags = await getMongoConnection().siteFlagsService.get();
        const auth = flags.auth ?? {};
        res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
        return res.status(200).json({
            clientLoginEnabled: Boolean((auth as any).clientLoginEnabled),
            providerMagicLink: Boolean((auth as any).providerMagicLink ?? true),
            providerCredentials: Boolean((auth as any).providerCredentials),
            providerGoogle: Boolean((auth as any).providerGoogle),
            providerFacebook: Boolean((auth as any).providerFacebook),
            providerApple: Boolean((auth as any).providerApple),
        });
    } catch (err) {
        // Fail closed — middleware treats a non-200 as "off" anyway,
        // but we surface the error code for diagnostics.
        return res.status(500).json({
            clientLoginEnabled: false,
            error: String((err as Error).message || err),
        });
    }
}
