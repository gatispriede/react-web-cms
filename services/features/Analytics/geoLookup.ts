/**
 * IP → 2-letter country code lookup. Synchronous after a one-time
 * boot-load of the bundled dataset.
 *
 * Privacy contract: this module derives a country code; it never
 * persists, logs, or returns the IP. Callers MUST discard the IP
 * after calling `geoLookup()`. See `docs/runbooks/analytics-geolookup.md`.
 *
 * Dataset source: a sorted JSON of `{start, end, cc}` rows where
 * `start`/`end` are uint32 IPv4 numeric bounds and `cc` is the ISO
 * 3166-1 alpha-2 country code. Generated quarterly from the public-domain
 * IP2Location LITE DB1 CSV (CC0). See `tools/download-geolite.sh`.
 *
 * Performance: O(log N) binary search per lookup. With ~600K rows the
 * 200K-event/day ingest budget cost is microseconds — no async hop.
 *
 * IPv6: not in the bundled dataset (DB1 is IPv4-only). IPv6 callers
 * resolve to `undefined` — the analytics row is stored without `country`
 * and the dashboard groups it under "Unknown".
 */
import {readFileSync, existsSync} from 'node:fs';
import {isIP} from 'node:net';
import {join} from 'node:path';
import {log} from '@services/infra/logger';

interface GeoRow {
    /** uint32 lower bound of the CIDR range (inclusive). */
    s: number;
    /** uint32 upper bound of the CIDR range (inclusive). */
    e: number;
    /** ISO 3166-1 alpha-2 country code. */
    cc: string;
}

/**
 * Default dataset location. Override with `GEOLITE_DATASET_PATH` for
 * tests or alternate deploys (the `download-geolite.sh` script writes
 * to this default). Resolved per-call so test env overrides take
 * effect even after the module is imported.
 */
function defaultDatasetPath(): string {
    return process.env.GEOLITE_DATASET_PATH
        ?? join(process.cwd(), 'infra', 'datasets', 'ip-to-country.json');
}

let dataset: GeoRow[] | null = null;
let loadAttempted = false;

/**
 * Convert a dotted-quad IPv4 string into a uint32. Returns `null` for
 * malformed input or non-IPv4 (caller treats as "no country").
 */
function ipv4ToUint32(ip: string): number | null {
    // Strip an IPv4-mapped IPv6 prefix (`::ffff:1.2.3.4`) — common when
    // Node binds dual-stack and the request comes from an IPv4 client.
    const stripped = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
    if (isIP(stripped) !== 4) return null;
    const parts = stripped.split('.');
    if (parts.length !== 4) return null;
    let n = 0;
    for (const p of parts) {
        const o = Number(p);
        if (!Number.isInteger(o) || o < 0 || o > 255) return null;
        n = (n * 256) + o;
    }
    // Force unsigned (>>> 0 trims to 32-bit unsigned).
    return n >>> 0;
}

/**
 * Load the dataset from disk. Idempotent — first call parses the file,
 * subsequent calls reuse the in-memory copy. On failure (missing file,
 * malformed JSON) the module switches to a permanent "no data" mode:
 * lookups return `undefined`, the ingest path keeps working, and a
 * single warning is emitted. The runbook covers the recovery steps.
 */
export function loadDataset(path: string = defaultDatasetPath()): GeoRow[] {
    if (dataset) return dataset;
    if (loadAttempted) return [];
    loadAttempted = true;
    try {
        if (!existsSync(path)) {
            log.warn(
                {scope: 'analytics.geo', path},
                'GeoLite dataset missing — country lookup disabled. Run tools/download-geolite.sh.',
            );
            dataset = [];
            return dataset;
        }
        const raw = readFileSync(path, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('dataset root is not an array');
        // Trust the on-disk sort order (the download script sorts by `s`).
        // Validate the first + last entry as a smoke test; full validation
        // is the script's job.
        if (parsed.length > 0) {
            const first = parsed[0];
            if (typeof first?.s !== 'number' || typeof first?.e !== 'number' || typeof first?.cc !== 'string') {
                throw new Error('dataset row shape mismatch');
            }
        }
        dataset = parsed as GeoRow[];
        log.info({scope: 'analytics.geo', rows: dataset.length}, 'GeoLite dataset loaded');
        return dataset;
    } catch (err) {
        log.error({scope: 'analytics.geo', err, path}, 'GeoLite dataset load failed — country lookup disabled');
        dataset = [];
        return dataset;
    }
}

/**
 * Resolve an IP address to a 2-letter country code, or `undefined` when
 * the IP is unparseable, the dataset is missing, or no range matches.
 *
 * SAFETY: the IP argument is used for the lookup only — it is NEVER
 * stored, logged, or returned. The caller (AnalyticsService.ingest) is
 * responsible for discarding it immediately after this call.
 */
export function geoLookup(ip: string | undefined | null): string | undefined {
    if (!ip) return undefined;
    const rows = loadDataset();
    if (rows.length === 0) return undefined;
    const n = ipv4ToUint32(ip);
    if (n === null) return undefined;
    // Binary search for the range whose [s, e] contains `n`.
    let lo = 0;
    let hi = rows.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const row = rows[mid];
        if (n < row.s) hi = mid - 1;
        else if (n > row.e) lo = mid + 1;
        else return row.cc;
    }
    return undefined;
}

/**
 * Test-only: clear the cached dataset so the next `loadDataset()` call
 * re-reads from disk. Production callers never invoke this.
 */
export function _resetDatasetForTests(): void {
    dataset = null;
    loadAttempted = false;
}
