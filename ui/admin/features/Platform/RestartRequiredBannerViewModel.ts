import {observable} from '@client/lib/state/observable';

export interface RestartReason {
    source: string;
    detail: string;
    since: string;
    key?: string;
}

export interface RestartStatus {
    bootId: string;
    uptimeMs: number;
    supervised: boolean;
    restartEnabled: boolean;
    reasons: RestartReason[];
}

export async function fetchStatus(): Promise<RestartStatus | null> {
    try {
        const r = await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query: `{ mongo { getRestartStatus } }`}),
        });
        const json = await r.json();
        const raw = json?.data?.mongo?.getRestartStatus;
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export async function postRestart(): Promise<{ok: boolean; bootId?: string; error?: string}> {
    try {
        const r = await fetch('/api/graphql', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({query: `mutation { mongo { requestServerRestart } }`}),
        });
        const json = await r.json();
        if (json.errors?.length) return {ok: false, error: json.errors[0].message};
        const raw = json?.data?.mongo?.requestServerRestart;
        return raw ? JSON.parse(raw) : {ok: false, error: 'invalid response'};
    } catch (err) {
        return {ok: false, error: String(err)};
    }
}

/** Poll `/api/health` until `bootId` differs from `oldBootId` or timeout. */
export async function waitForRestart(oldBootId: string, timeoutMs = 60_000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            const r = await fetch('/api/health', {cache: 'no-store'});
            if (r.ok) {
                const j = await r.json();
                if (j?.bootId && j.bootId !== oldBootId) return true;
            }
        } catch {
            // 503 / network drop while shutdown is in progress — keep polling.
        }
    }
    return false;
}

/** VM3 — restart-required banner. Holds latest status + restart-in-flight flag. */
export class RestartRequiredBannerViewModel {
    status:    RestartStatus | null = null;
    restarting = false;

    constructor() { return observable(this); }

    setRestarting(v: boolean): void { this.restarting = v; }

    async refresh(): Promise<void> {
        this.status = await fetchStatus();
    }
}
