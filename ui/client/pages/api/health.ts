import type {NextApiRequest, NextApiResponse} from 'next';
import {bootId, uptimeMs} from '@services/infra/bootId';

/**
 * Health endpoint for the server-restart admin flow.
 *
 * Per `docs/features/platform/server-restart.md`: the admin UI captures
 * `bootId` BEFORE triggering `requestServerRestart`, then polls this
 * endpoint until the bootId changes (= new process is up). `uptimeMs`
 * is a secondary signal so the UI can spot a polling-during-shutdown
 * race (uptime drops AND bootId changes).
 *
 * Public — no auth — but reveals only the bootId and uptime, no
 * structural information.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse): void {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
        status: 'ok',
        bootId,
        uptimeMs: uptimeMs(),
        supervised: (process.env.SERVER_SUPERVISED ?? '').toLowerCase() === 'true',
        restartEnabled: (process.env.SERVER_RESTART_ENABLED ?? 'true').toLowerCase() !== 'false',
    });
}
