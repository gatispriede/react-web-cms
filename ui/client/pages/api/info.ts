import type {NextApiRequest, NextApiResponse} from 'next';
import {bootId} from '@services/infra/bootId';

/**
 * F5 — public, anonymous build-info probe.
 *
 * Designed for external monitors (UptimeRobot, status pages, smoke
 * tests) — the response is intentionally minimal:
 *   - `version`        the deployed Git SHA (already public via the
 *                      released artifact tag; not a secret).
 *   - `bootId`         the per-process UUID. Useful for "did the
 *                      restart land" without polling `/api/health`.
 *   - `buildTimestamp` ISO string (or null when not stamped).
 *
 * **Audit gate**: nothing else may be added here. No env vars, no
 * service-internal counts, no feature manifest, no PII. Anything
 * operational lives behind the admin-gated `getDiagnostics` query.
 */

interface PublicInfo {
    readonly version: string;
    readonly bootId: string;
    readonly buildTimestamp: string | null;
}

export default function handler(_req: NextApiRequest, res: NextApiResponse<PublicInfo>): void {
    res.setHeader('Cache-Control', 'no-store');
    const payload: PublicInfo = {
        version: process.env.GIT_SHA ?? 'unknown',
        bootId,
        buildTimestamp: process.env.BUILD_TS ?? null,
    };
    res.status(200).json(payload);
}
