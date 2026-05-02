import {log} from './logger';

/**
 * Restart-reason registry — module-scoped Map of pending boot-time
 * configuration changes that won't take full effect until the process
 * restarts. The admin UI reads through `getRestartStatus()` and
 * surfaces a banner; one click on the restart button cycles the
 * server and clears the registry.
 *
 * Per `docs/features/platform/server-restart.md` (decision 2026-05-02):
 * the registry is **generic** — feature flags + default locale switch +
 * future boot-bound config all aggregate into one banner. Each caller
 * registers a `source` (the feature/subsystem) and an optional `detail`
 * (specific reason text).
 */

export interface RestartReason {
    /** The subsystem that flagged the restart — e.g. `feature-flags`, `i18n`, `themes`. */
    readonly source: string;
    /** Free-text detail surfaced in the admin banner. */
    readonly detail: string;
    /** ISO timestamp captured when the reason was registered. */
    readonly since: string;
    /** Optional grouping key — multiple `mark` calls with the same key collapse to one row. */
    readonly key?: string;
}

const reasons = new Map<string, RestartReason>();

function keyFor(r: Pick<RestartReason, 'source' | 'key' | 'detail'>): string {
    return r.key ? `${r.source}:${r.key}` : `${r.source}:${r.detail}`;
}

/**
 * Mark the server as needing a restart for `source` to fully apply
 * `detail`. Idempotent on `(source, key|detail)` — repeated calls don't
 * stack duplicate banner rows.
 */
export function markRestartRequired(input: Omit<RestartReason, 'since'> & {since?: string}): void {
    const reason: RestartReason = {
        source: input.source,
        detail: input.detail,
        since: input.since ?? new Date().toISOString(),
        key: input.key,
    };
    const k = keyFor(reason);
    if (!reasons.has(k)) {
        log.info({scope: 'restart.required', source: reason.source, detail: reason.detail}, 'restart-required marked');
    }
    reasons.set(k, reason);
}

/**
 * Drop a previously-marked reason. Useful when an operator reverts a
 * change before restarting (e.g. flips a feature back off, undoing the
 * "needs restart" condition).
 */
export function clearRestartReason(source: string, key?: string): void {
    const probe: Pick<RestartReason, 'source' | 'key' | 'detail'> = {source, key, detail: ''};
    if (key) {
        reasons.delete(keyFor(probe));
        return;
    }
    // No key → drop every reason from this source.
    for (const k of [...reasons.keys()]) {
        if (k.startsWith(`${source}:`)) reasons.delete(k);
    }
}

/** Snapshot the current registry — admin UI / GraphQL surface read here. */
export function getRestartReasons(): readonly RestartReason[] {
    return [...reasons.values()];
}

/** Reset the registry. Called inside the graceful-shutdown path so the
 *  next process boots clean, and exported for tests. */
export function _resetRestartRegistryForTest(): void {
    reasons.clear();
}
