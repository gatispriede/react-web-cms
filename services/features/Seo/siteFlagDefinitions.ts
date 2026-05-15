/**
 * Site-flag definition registry — extracted from `SiteFlagsService.ts`
 * to bundle the 4-place add pattern (interface entry + default + read-side
 * type-guard + save-side whitelist) into a single `defineFlag()` call.
 *
 * Background: every new namespaced site-flag previously required four
 * coordinated edits in `SiteFlagsService.ts`. That file was pushing past
 * the 400-line guidance threshold after the upcoming wave of additions
 * (`commerce.checkoutEnabled`, `auth.clientLoginEnabled`,
 * `commerce.defaultProductAudience`, etc.). Centralising registration
 * here lets consumer features declare a flag at module-load time without
 * ever touching the service file again.
 *
 * Scope: this registry covers the **new sub-record flags** only
 * (`commerce.*`, `auth.*`, `theme.*`, `seo.*`). The legacy top-level
 * flags (`blogEnabled`, `layoutMode`, `inquiryEnabled`, …) keep their
 * existing inline handling in `SiteFlagsService.get / save` to preserve
 * byte-for-byte read/write contracts for already-shipped consumers.
 *
 * Pattern reference: `docs/architecture/site-flags.md`.
 */

import type {ICommerceFlags, IAuthFlags, IThemeFlags, ISeoSubFlags} from './SiteFlagsService';

/** Dotted-path key for a registered flag. Constrained to the four
 *  sub-record namespaces so a typo collapses into a `tsc` error rather
 *  than a silent no-op at save time. */
export type FlagPath =
    | `commerce.${keyof ICommerceFlags & string}`
    | `auth.${keyof IAuthFlags & string}`
    | `theme.${keyof IThemeFlags & string}`
    | `seo.${keyof ISeoSubFlags & string}`;

/** One registered flag. The `typeGuard` runs at both read and write time
 *  — on read it gates the stored value against tampering; on write it
 *  rejects malformed payloads from the admin / MCP without crashing. */
export interface IFlagDefinition<T> {
    /** Dotted path, e.g. `commerce.checkoutEnabled`. */
    path: FlagPath;
    /** Returned when the stored value is missing or fails `typeGuard`. */
    defaultValue: T;
    /** Type-narrow validator for the stored shape. */
    typeGuard: (v: unknown) => v is T;
    /** `public-readable` flags are safe to embed in `InitialPageData` for
     *  SSR; `admin-only` flags never leave the server. Default
     *  `admin-only` — opt in explicitly. */
    audience?: 'public-readable' | 'admin-only';
    /** Operator-facing one-liner. Used by the admin settings UI and the
     *  `site.flagDefinitions.list` MCP tool. */
    description: string;
}

/** Internal mutable registry. Keyed by `path` for O(1) lookup; iteration
 *  order is insertion order which matches the order consumers call
 *  `defineFlag()` — stable enough for the admin UI to render flags in a
 *  deterministic order. */
const REGISTRY = new Map<FlagPath, IFlagDefinition<unknown>>();

/**
 * Register a flag definition.
 *
 * Called by consuming features at module load (typically next to the
 * feature's own service constructor). The registration replaces the
 * 4-place edit-this-file pattern previously required in
 * `SiteFlagsService.ts`. Re-registering the same path overrides the
 * previous definition — this lets tests stub flags without leaking state
 * between describe blocks.
 */
export function defineFlag<T>(def: IFlagDefinition<T>): void {
    REGISTRY.set(def.path, def as IFlagDefinition<unknown>);
}

/** Read-only snapshot of every registered flag. Stable insertion order. */
export function listFlagDefinitions(): readonly IFlagDefinition<unknown>[] {
    return Array.from(REGISTRY.values());
}

/** Lookup one flag by dotted path. Returns `null` (not undefined) so a
 *  missing flag is unambiguous when JSON-serialised over MCP. */
export function getFlagDefinition(path: string): IFlagDefinition<unknown> | null {
    return REGISTRY.get(path as FlagPath) ?? null;
}

/** Reset the registry — test-only. Avoid in production code paths. */
export function _resetFlagRegistryForTests(): void {
    REGISTRY.clear();
}

// --------------------------------------------------------------------
// Type-guard utilities — pass directly to `defineFlag({typeGuard})`.
// Keeping them here (not in a generic `validators.ts`) makes the
// "register a flag" mental model fit on one screen.
// --------------------------------------------------------------------

/** Boolean type-guard — the most common flag shape. */
export const isBoolean = (v: unknown): v is boolean => typeof v === 'boolean';

/** Plain-string type-guard. Does not enforce length / content — wrap
 *  with a tighter check if the consumer needs RFC validation. */
export const isString = (v: unknown): v is string => typeof v === 'string';

/** Finite number type-guard. Rejects NaN / Infinity. */
export const isFiniteNumber = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);

/**
 * Construct a type-guard that accepts only members of `values`.
 * The returned predicate narrows to the union of `T` (e.g.
 * `'tabs' | 'scroll' | 'auto'`) — much sharper than `isString`.
 */
export function isOneOf<T extends string>(values: readonly T[]) {
    return (v: unknown): v is T =>
        typeof v === 'string' && (values as readonly string[]).includes(v);
}

// --------------------------------------------------------------------
// Sub-record assembly — walked by `SiteFlagsService.get / save`.
// --------------------------------------------------------------------

/** Namespace component of a `FlagPath`. */
export type FlagNamespace = 'commerce' | 'auth' | 'theme' | 'seo';

/** Parse `'commerce.checkoutEnabled'` → `{ns: 'commerce', key: 'checkoutEnabled'}`. */
export function parseFlagPath(path: FlagPath): {ns: FlagNamespace; key: string} {
    const idx = path.indexOf('.');
    return {ns: path.slice(0, idx) as FlagNamespace, key: path.slice(idx + 1)};
}

/**
 * Build a fully-populated sub-record (e.g. `commerce`) from the stored
 * partial value, defaulting unset / invalid fields. Each registered
 * flag in the namespace contributes one entry; unregistered keys on
 * the stored doc are dropped (defence against schema drift).
 */
export function buildSubRecord<R extends Record<string, unknown>>(
    ns: FlagNamespace,
    stored: Partial<R> | undefined,
): R {
    const out: Record<string, unknown> = {};
    for (const def of REGISTRY.values()) {
        const parsed = parseFlagPath(def.path);
        if (parsed.ns !== ns) continue;
        const raw = stored?.[parsed.key as keyof R];
        out[parsed.key] = def.typeGuard(raw) ? raw : def.defaultValue;
    }
    return out as R;
}

/**
 * Sanitise a write-side patch for `ns`. Only known keys with a
 * passing `typeGuard` are kept; everything else falls back to the
 * `current` value (read-side semantics). Mirrors `SiteFlagsService.save`'s
 * legacy whitelist-per-field discipline.
 */
export function sanitizeSubRecord<R extends Record<string, unknown>>(
    ns: FlagNamespace,
    patch: Partial<R> | undefined,
    current: R,
): R {
    const out: Record<string, unknown> = {...current};
    if (!patch || typeof patch !== 'object') return out as R;
    for (const def of REGISTRY.values()) {
        const parsed = parseFlagPath(def.path);
        if (parsed.ns !== ns) continue;
        const raw = (patch as Record<string, unknown>)[parsed.key];
        if (raw === undefined) continue;
        out[parsed.key] = def.typeGuard(raw) ? raw : current[parsed.key as keyof R];
    }
    return out as R;
}
