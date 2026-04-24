import type {NextApiRequest, NextApiResponse} from 'next';
import {getServerSession} from 'next-auth/next';
import {authOptions} from './auth/[...nextauth]';
import {UserRole} from '@interfaces/IUser';

const ROLE_RANK: Record<UserRole, number> = {viewer: 0, editor: 1, admin: 2};

export async function requireRole(
    req: NextApiRequest,
    res: NextApiResponse,
    minimum: UserRole
): Promise<{ok: true; role: UserRole} | {ok: false}> {
    const session = await getServerSession(req, res, authOptions);
    const role = ((session?.user as any)?.role ?? 'viewer') as UserRole;
    if (!session?.user) {
        res.status(401).json({error: 'Unauthorized'});
        return {ok: false};
    }
    if (ROLE_RANK[role] < ROLE_RANK[minimum]) {
        res.status(403).json({error: `Forbidden: ${minimum} role required`, currentRole: role});
        return {ok: false};
    }
    return {ok: true, role};
}
