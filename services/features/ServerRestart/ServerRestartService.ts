import {bootId, uptimeMs} from '@services/infra/bootId';
import {getRestartReasons, type RestartReason} from '@services/infra/restartRequired';
import {log} from '@services/infra/logger';

/**
 * Server-restart feature — graceful shutdown signal + supervisor respawn.
 * Per `docs/features/platform/server-restart.md` (decision 2026-05-02):
 *
 *   - `requestRestart()` records the actor in the audit log, schedules
 *     a graceful shutdown after a short delay (so the GraphQL response
 *     can flush), and returns immediately.
 *   - `gracefulShutdown()` runs Apollo `stop()` + drains in-flight
 *     requests + `process.exit(0)`. The supervisor (systemd / pm2 /
 *     Docker / DigitalOcean App Platform) re-spawns.
 *   - `health()` is the polling endpoint the admin UI hits to detect
 *     "the new process is up": new bootId + non-zero uptime.
 *
 * Detection of supervised vs unsupervised environment via the env var
 * `SERVER_SUPERVISED=true`. When unset, `requestRestart()` refuses with
 * a helpful error and the admin UI swaps the button for a "run
 * `npm run dev` again" hint.
 *
 * `SERVER_RESTART_ENABLED=false` disables the whole feature defensively
 * (operator opt-out).
 *
 * Rate limit: one restart per 30s, hard. Repeated calls inside the
 * window get a clear error rather than a queued restart.
 */

const RESTART_RATE_LIMIT_MS = 30_000;
const SHUTDOWN_DELAY_MS = 500;
const DRAIN_TIMEOUT_MS = 5_000;

let lastRestartRequestedAt = 0;

export interface ServerHealth {
    readonly status: 'ok';
    readonly bootId: string;
    readonly uptimeMs: number;
    readonly supervised: boolean;
    readonly restartEnabled: boolean;
}

export interface RestartRequestResult {
    readonly ok: boolean;
    readonly error?: string;
    readonly bootId?: string;
    readonly retryAfterMs?: number;
}

export interface RestartStatus {
    readonly bootId: string;
    readonly uptimeMs: number;
    readonly supervised: boolean;
    readonly restartEnabled: boolean;
    readonly reasons: readonly RestartReason[];
}

export class ServerRestartService {
    /**
     * `apolloStop` is wired by the GraphQL boot path so we can call
     * `apolloServer.stop()` from inside `gracefulShutdown` without a
     * circular import. Set via `setApolloStop(fn)` once the server has
     * built. Optional — non-Apollo deployments (CLI tools, the e2e
     * standalone build server) skip this hook.
     */
    private apolloStop?: () => Promise<void>;

    setApolloStop(fn: () => Promise<void>): void {
        this.apolloStop = fn;
    }

    isSupervised(): boolean {
        return (process.env.SERVER_SUPERVISED ?? '').toLowerCase() === 'true';
    }

    isRestartEnabled(): boolean {
        return (process.env.SERVER_RESTART_ENABLED ?? 'true').toLowerCase() !== 'false';
    }

    health(): ServerHealth {
        return {
            status: 'ok',
            bootId,
            uptimeMs: uptimeMs(),
            supervised: this.isSupervised(),
            restartEnabled: this.isRestartEnabled(),
        };
    }

    status(): RestartStatus {
        return {
            bootId,
            uptimeMs: uptimeMs(),
            supervised: this.isSupervised(),
            restartEnabled: this.isRestartEnabled(),
            reasons: getRestartReasons(),
        };
    }

    /**
     * Schedule a graceful shutdown. Returns `{ok: true, bootId}` when
     * the request was accepted; the response is sent before the shutdown
     * delay fires. The admin UI captures the bootId, then polls
     * `/api/health` until the bootId changes (= new process is up).
     */
    requestRestart(actor: string | undefined): RestartRequestResult {
        if (!this.isRestartEnabled()) {
            return {ok: false, error: 'Server restart is disabled (SERVER_RESTART_ENABLED=false)'};
        }
        if (!this.isSupervised()) {
            return {ok: false, error: 'Server is not running under a supervisor — restart manually'};
        }
        const now = Date.now();
        const elapsed = now - lastRestartRequestedAt;
        if (elapsed < RESTART_RATE_LIMIT_MS) {
            return {
                ok: false,
                error: 'Restart was requested recently — try again shortly',
                retryAfterMs: RESTART_RATE_LIMIT_MS - elapsed,
            };
        }
        lastRestartRequestedAt = now;
        log.info({scope: 'restart.requested', actor: actor ?? 'unknown', bootId}, 'server restart requested');
        // Fire-and-forget — give the GraphQL response time to flush.
        setTimeout(() => {
            void this.gracefulShutdown(actor).catch((err) => {
                log.error({scope: 'restart.shutdown', err}, 'graceful shutdown threw — forcing exit');
                process.exit(1);
            });
        }, SHUTDOWN_DELAY_MS);
        return {ok: true, bootId};
    }

    private async gracefulShutdown(actor: string | undefined): Promise<void> {
        log.info({scope: 'restart.shutdown.start', actor: actor ?? 'unknown', bootId}, 'graceful shutdown begin');
        if (this.apolloStop) {
            try {
                await Promise.race([
                    this.apolloStop(),
                    new Promise((resolve) => setTimeout(resolve, DRAIN_TIMEOUT_MS)),
                ]);
            } catch (err) {
                log.warn({scope: 'restart.shutdown.apollo', err}, 'apollo stop threw — continuing');
            }
        }
        // Mongo connection close + other resources are deliberately NOT
        // awaited here — the supervisor will SIGKILL after a few seconds
        // if the process hasn't exited cleanly. Better to clip a few
        // mid-flight queries than to hang indefinitely.
        log.info({scope: 'restart.shutdown.done'}, 'process.exit(0)');
        process.exit(0);
    }

    /** Test-only escape hatch — reset the rate-limit clock. */
    _resetRateLimitForTest(): void {
        lastRestartRequestedAt = 0;
    }
}
