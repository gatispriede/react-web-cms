import {randomUUID} from 'crypto';

/**
 * Module-load `bootId` — a UUID generated once per process. The admin
 * UI's restart-and-poll flow reads this through `/api/health`; same id
 * means same process, different id means a restart succeeded.
 *
 * Module-scope const → identity is sticky for the lifetime of this
 * Node module; a graceful restart re-imports the module on the new
 * process and gets a fresh value.
 */
export const bootId: string = randomUUID();

/**
 * `process.uptime()` in milliseconds, captured at the call site. Surfaced
 * on `/api/health` so the admin UI can spot a restart-during-poll race
 * (uptime drops AND bootId changes).
 */
export function uptimeMs(): number {
    return Math.round(process.uptime() * 1000);
}
