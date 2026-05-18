import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

/**
 * Edge-callable lightweight read of `commerce.*` flags. Used by the
 * Next.js middleware to short-circuit `/checkout/*` to 404 when the
 * master switch is off. Kept to a tiny boolean response so the edge
 * call adds <100ms in the worst case.
 *
 * Public — no auth gate. The flag is `audience: 'public-readable'`
 * (see `services/features/Commerce/commerceFlags.ts`), so leaking the
 * value at the edge is by design.
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse): Promise<void> {
    try {
        const raw = await getMongoConnection().getSiteFlags();
        const flags = JSON.parse(raw);
        const checkoutEnabled = (flags?.commerce?.checkoutEnabled === true);
        res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
        res.status(200).json({checkoutEnabled});
    } catch {
        // Fail-closed: when the flag can't be read, assume checkout is off.
        // A catalogue-only render is a smaller harm than exposing checkout
        // routes the operator may have meant to hide.
        res.status(200).json({checkoutEnabled: false});
    }
}
