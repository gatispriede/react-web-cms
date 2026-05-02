/**
 * Feature-flag resolver — single source of truth for "is feature X
 * enabled?" Read at boot (`bootFeaturesSync`), per-request (route
 * gates, resolver gates), and by the admin surface that displays /
 * edits the flag state.
 *
 * Resolution precedence (highest wins):
 *   1. Env var `FEATURE_<UPPER>` set to `false` / `0` / `off` — disabled
 *   2. Env var `FEATURE_<UPPER>` set to `true` / `1` / `on` — enabled
 *   3. Mongo override row (written by the admin UI / MCP tool, primed
 *      into a sync cache by `featureFlagsFeature.onBoot`)
 *   4. Default policy (per-feature, see DEFAULT_DISABLED below)
 *
 * Env var name convention: feature id `cart` → `FEATURE_CART`. Hyphens
 * + camelCase get normalised to underscored upper-case so `customerAuth`
 * → `FEATURE_CUSTOMER_AUTH`.
 *
 * Defaults match the spec ([plug-and-play-features.md]):
 *   - CMS-core (everything that's coreInfrastructure) — always on
 *   - E-commerce stack (products, cart, inventory, orders) — OFF by default
 *   - MCP (token panel + tools) — OFF by default
 *   - Everything else — on
 */

const TRUE_VALUES = new Set(['true', '1', 'on', 'yes', 'enabled']);
const FALSE_VALUES = new Set(['false', '0', 'off', 'no', 'disabled']);

/** Disabled-by-default feature ids — operator must opt in via env or Mongo override. */
const DEFAULT_DISABLED: ReadonlySet<string> = new Set([
    'products',
    'cart',
    'inventory',
    'orders',
    // 'mcp' intentionally removed — MCP token management is core admin tooling,
    // always enabled. The e-commerce stack stays opt-in.
]);

/**
 * Single source of truth for the env-var name that drives feature `id`.
 * `customerAuth` → `FEATURE_CUSTOMER_AUTH`, `cart` → `FEATURE_CART`.
 * Used by the env reader, the admin panel, and the MCP tool — change
 * the convention here and it propagates everywhere.
 */
export function envKeyForFeature(id: string): string {
    return `FEATURE_${id.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
}

// Local alias kept for the in-file reader below.
const envKey = envKeyForFeature;

/**
 * Resolved-state cache. Cleared on `primeFeatureFlagCache` so a flag
 * write through the admin UI takes effect for the next call. Boot-time
 * env reads stay sticky between cache primes (they're priced into the
 * cached result).
 */
const resolved = new Map<string, boolean>();

/**
 * Mongo override snapshot — populated by `featureFlagsFeature.onBoot`
 * from the `FeatureFlags` collection, refreshed via
 * `primeFeatureFlagCache(rows)` after every admin write. Keys are
 * feature ids, values are the explicit `enabled` boolean from the row.
 * Absent key = no override, fall through to the default.
 */
const mongoOverrides = new Map<string, boolean>();

/**
 * Refresh the mongo-override snapshot. Called by:
 *   - `featureFlagsFeature.onBoot` once at boot (initial prime)
 *   - The `setFeatureFlag` / `clearFeatureFlag` mutations after a write
 *     so subsequent reads pick up the new value within the same process.
 *
 * Resolved-state cache is invalidated on every prime so the next read
 * re-evaluates against the current env + the new override snapshot.
 */
export function primeFeatureFlagCache(rows: readonly {id: string; enabled: boolean}[]): void {
    mongoOverrides.clear();
    for (const r of rows) mongoOverrides.set(r.id, !!r.enabled);
    resolved.clear();
}

/**
 * Resolve a single feature's enabled state. Reads env first (operator
 * pin always wins), then the Mongo override snapshot, then the
 * per-feature default. Result is cached until the next
 * `primeFeatureFlagCache` call.
 */
export function isFeatureEnabled(id: string): boolean {
    const cached = resolved.get(id);
    if (cached !== undefined) return cached;

    const raw = process.env[envKey(id)]?.toLowerCase().trim();
    let result: boolean;
    if (raw && FALSE_VALUES.has(raw)) {
        result = false;
    } else if (raw && TRUE_VALUES.has(raw)) {
        result = true;
    } else if (mongoOverrides.has(id)) {
        result = mongoOverrides.get(id)!;
    } else {
        result = !DEFAULT_DISABLED.has(id);
    }

    resolved.set(id, result);
    return result;
}

/**
 * Lookup-only — does this feature have a Mongo override row? Lets the
 * admin UI distinguish "user pinned via UI" from "default behaviour" so
 * a "Reset to default" button can clear only the explicit overrides.
 */
export function hasMongoOverride(id: string): boolean {
    return mongoOverrides.has(id);
}

/** Test-only — clear the cache so a follow-up call re-reads env. */
export function _resetFeatureFlagsCacheForTest(): void {
    resolved.clear();
    mongoOverrides.clear();
}

/** Snapshot of the resolved state for every requested id. */
export function snapshotFeatureFlags(ids: readonly string[]): Record<string, boolean> {
    const out: Record<string, boolean> = {};
    for (const id of ids) out[id] = isFeatureEnabled(id);
    return out;
}

/** The default-disabled list, exported for the admin UI's hint copy. */
export const FEATURE_FLAG_DEFAULTS_DISABLED = [...DEFAULT_DISABLED];
