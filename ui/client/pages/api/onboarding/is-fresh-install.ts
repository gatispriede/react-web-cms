import type {NextApiRequest, NextApiResponse} from 'next';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

/**
 * REST companion to the `isFreshInstall` GraphQL query — used by the
 * AdminApp's first-run guard so we don't have to wait for the gqty
 * client to be regenerated after the Q7 onboarding feature landed.
 *
 * Returns `{fresh: boolean}`. Anonymous (no auth required) — the guard
 * runs before the user can sign in on a brand-new install.
 *
 * Detection rule mirrors `OnboardingService.isFreshInstall()`: zero
 * admin-kind users in the Users collection.
 */
export default async function handler(
    _req: NextApiRequest,
    res: NextApiResponse<{fresh: boolean; error?: string}>,
): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const conn = getMongoConnection();
        const onboardingSvc = (conn as any).featureServices?.onboarding;
        if (onboardingSvc?.isFreshInstall) {
            const fresh = await onboardingSvc.isFreshInstall();
            res.status(200).json({fresh: !!fresh});
            return;
        }
        // Service not registered yet — refuse to redirect.
        res.status(200).json({fresh: false});
    } catch (err) {
        res.status(200).json({fresh: false, error: String(err)});
    }
}
