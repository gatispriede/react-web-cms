import type {Db} from 'mongodb';
import type {RedisLike} from './redis';
import type {FeatureManifest, FeatureContext, FeatureIndexSpec, FeatureAuthzContribution} from './featureManifest';
import {featureRegistry as registry} from './featureRegistry.generated';
import {isFeatureEnabled} from './featureFlags';
import {log} from './logger';

/**
 * Resolve a manifest's enabled state at boot time.
 *
 * Precedence:
 *   1. `coreInfrastructure: true` — always enabled, ignore everything else
 *   2. `manifest.enabled` is a function or boolean — use that
 *   3. Fall back to the env-driven `isFeatureEnabled(id)` default
 *
 * This is what `bootFeaturesSync` consults when deciding whether to
 * skip a feature; the same predicate also drives the admin "feature
 * flags" surface so the displayed state matches what the runtime sees.
 */
export function resolveEnabled(manifest: FeatureManifest): boolean {
    if (manifest.coreInfrastructure) return true;
    if (typeof manifest.enabled === 'function') {
        try { return manifest.enabled(); }
        catch (err) {
            log.warn({scope: 'feature.flag.eval', feature: manifest.id, err}, 'enabled() threw — defaulting to disabled');
            return false;
        }
    }
    if (typeof manifest.enabled === 'boolean') return manifest.enabled;
    return isFeatureEnabled(manifest.id);
}

/**
 * Filter the static registry by `enabled`, then verify dependencies.
 * If feature X requires feature Y, X is only registered when Y is also
 * enabled — disabling Y while X is on auto-disables X with a logged
 * warning. Avoids the "checkout on, cart off" half-state.
 */
function activeFeatures(): readonly FeatureManifest[] {
    const enabledById = new Map<string, FeatureManifest>();
    for (const f of registry) {
        if (resolveEnabled(f)) enabledById.set(f.id, f);
    }
    let changed = true;
    while (changed) {
        changed = false;
        for (const [id, f] of enabledById) {
            for (const dep of f.requires ?? []) {
                if (!enabledById.has(dep)) {
                    log.warn({scope: 'feature.flag.cascade', feature: id, missing: dep},
                        'feature auto-disabled because a required dependency is off');
                    enabledById.delete(id);
                    changed = true;
                    break;
                }
            }
        }
    }
    return [...enabledById.values()];
}

/**
 * Public surface for the manifest-based feature system.
 *
 * The codegen-emitted `featureRegistry.generated.ts` lists every active
 * feature manifest. Everything else in the system goes through the
 * helpers in this file — `bootFeatures` (construct + index + onBoot),
 * `composedSchemaSDL`, `composedResolvers`, `composedAuthz`. That keeps
 * the consuming files (`mongoDBConnection`, `graphqlResolvers`) free of
 * feature-specific imports.
 */

/**
 * Topological sort over `requires`. Throws on missing-dep or cycle.
 * Stable: same input always emits the same order, so the boot path is
 * deterministic for log forensics.
 */
export function sortFeatures(features: readonly FeatureManifest[]): FeatureManifest[] {
    const byId = new Map(features.map(f => [f.id, f]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const out: FeatureManifest[] = [];

    function visit(id: string, parent: string | null): void {
        if (visited.has(id)) return;
        if (visiting.has(id)) {
            throw new Error(`featureRegistry: cycle detected involving ${id} (via ${parent})`);
        }
        const f = byId.get(id);
        if (!f) {
            throw new Error(`featureRegistry: ${parent ?? 'root'} requires '${id}' which is not registered`);
        }
        visiting.add(id);
        for (const dep of f.requires ?? []) visit(dep, id);
        visiting.delete(id);
        visited.add(id);
        out.push(f);
    }

    // Stable iteration order — process by id so a re-run produces the
    // same boot sequence.
    const ids = [...byId.keys()].sort();
    for (const id of ids) visit(id, null);
    return out;
}

export interface BootResult {
    /** Service map merged from every feature's `services` factory. */
    services: Record<string, unknown>;
    /** Order features booted in (after `requires` sort). For logging / introspection. */
    order: readonly string[];
}

/**
 * Synchronous half of feature boot — construct every service and merge
 * them into one map. This needs to be sync so `MongoDBConnection`'s
 * service getters return real instances by the time the FIRST request
 * lands; the original async-only path raced HTTP requests against a
 * mid-boot service map that read undefined for ~50 ms after cold start.
 *
 * The `db` handle from `client.db('DB')` is lazy — the real Mongo
 * connection happens on first operation, NOT here. Services that store
 * the handle in their constructor (every one in this codebase) are
 * therefore safe to build before the network is up.
 */
export function bootFeaturesSync(opts: {db: Db; redis: RedisLike; reconnect: () => Promise<void>}): Record<string, unknown> {
    const sorted = sortFeatures(activeFeatures());
    const services: Record<string, unknown> = {};
    for (const feature of sorted) {
        const ctx: FeatureContext = {db: opts.db, redis: opts.redis, services, reconnect: opts.reconnect};
        try {
            const built = feature.services?.(ctx);
            if (built) Object.assign(services, built);
        } catch (err) {
            log.error({scope: 'feature.boot.sync', feature: feature.id, err}, 'feature service factory failed');
            throw err;
        }
    }
    return services;
}

/**
 * Async half — apply indexes and run `onBoot` hooks in registry order.
 * Pre-populated `services` is reused as the context's service map so
 * features see each other (Cart's onBoot can read services.products
 * etc.). Failures inside an `onBoot` log + rethrow so a misbehaving
 * feature breaks deploy loud rather than half-booting silently.
 */
export async function bootFeaturesAsync(opts: {db: Db; redis: RedisLike; services: Record<string, unknown>; reconnect: () => Promise<void>}): Promise<BootResult> {
    const sorted = sortFeatures(activeFeatures());
    const order: string[] = [];
    for (const feature of sorted) {
        const ctx: FeatureContext = {db: opts.db, redis: opts.redis, services: opts.services, reconnect: opts.reconnect};
        try {
            await applyIndexes(opts.db, feature.indexes ?? []);
            await feature.onBoot?.(ctx);
            order.push(feature.id);
            log.info({scope: 'feature.boot', feature: feature.id}, 'feature booted');
        } catch (err) {
            log.error({scope: 'feature.boot', feature: feature.id, err}, 'feature boot failed');
            throw err;
        }
    }
    return {services: opts.services, order};
}

/**
 * Convenience wrapper — does both halves serially. Existing callers
 * stay on this; new race-sensitive call sites (the connection class)
 * can call the two halves separately to fence sync construction
 * against async finalisation.
 */
export async function bootFeatures(opts: {db: Db; redis: RedisLike; reconnect: () => Promise<void>}): Promise<BootResult> {
    const services = bootFeaturesSync(opts);
    return bootFeaturesAsync({...opts, services});
}

async function applyIndexes(db: Db, indexes: readonly FeatureIndexSpec[]): Promise<void> {
    for (const idx of indexes) {
        try {
            // Evaluate `expireAfterSeconds` thunks at boot time so
            // env-driven retention values pick up the live env.
            const opts: Record<string, unknown> = {...(idx.options ?? {})};
            const ttl = idx.options?.expireAfterSeconds;
            if (typeof ttl === 'function') {
                const resolved = ttl();
                if (typeof resolved === 'number' && resolved > 0) opts.expireAfterSeconds = resolved;
                else delete opts.expireAfterSeconds;
            }
            await db.collection(idx.collection).createIndex(idx.spec as any, opts as any);
        } catch (err) {
            // `createIndex` on an existing-equivalent index is a no-op;
            // a conflicting definition throws. Log + continue so one
            // bad spec doesn't kill the rest of the boot. The conflict
            // surfaces in the next deploy by failing here too.
            log.warn({scope: 'feature.index', collection: idx.collection, err}, 'index create failed');
        }
    }
}

/**
 * Compose the global functional-role list from every active feature's
 * `functionalRoles` declaration. Per-feature roles live next to their
 * Loader (e.g. Languages owns `translator`); the admin UI reads from
 * the merged list. Per `docs/features/platform/edit-levels.md`.
 *
 * Reads via the manifest's wrapper to keep the registry pipeline
 * Loader-agnostic; the `toManifest()` adapter forwards `functionalRoles`
 * untouched (added below).
 */
export function composedFunctionalRoles(): readonly import('@interfaces/IPermission').FunctionalRoleDescriptor[] {
    const seen = new Map<string, import('@interfaces/IPermission').FunctionalRoleDescriptor>();
    for (const f of activeFeatures()) {
        const roles = (f as FeatureManifest & {functionalRoles?: readonly import('@interfaces/IPermission').FunctionalRoleDescriptor[]}).functionalRoles;
        if (!roles) continue;
        for (const role of roles) {
            if (seen.has(role.id)) {
                log.warn({scope: 'feature.functionalRoles', role: role.id}, 'duplicate functional-role id — first declaration wins');
                continue;
            }
            seen.set(role.id, role);
        }
    }
    return [...seen.values()];
}

/** Concatenate SDL fragments. Order doesn't matter for additive `extend type` shapes. */
export function composedSchemaSDL(): string {
    return activeFeatures().map(f => f.schemaSDL ?? '').filter(Boolean).join('\n');
}

/**
 * Strict resolver merge — two features defining the same field is a
 * boot-time error, not a silent overwrite. Shallow merges per top-level
 * `Query`/`Mutation`/etc. block.
 */
export function composedResolvers(): Record<string, any> {
    const merged: Record<string, Record<string, unknown>> = {};
    for (const f of activeFeatures()) {
        if (!f.resolvers) continue;
        for (const [topKey, fields] of Object.entries(f.resolvers as Record<string, Record<string, unknown>>)) {
            if (!fields || typeof fields !== 'object') continue;
            const target = (merged[topKey] ??= {});
            for (const [name, resolver] of Object.entries(fields)) {
                if (target[name] !== undefined) {
                    throw new Error(`featureRegistry: duplicate resolver ${topKey}.${name} (conflict between '${f.id}' and a prior feature)`);
                }
                target[name] = resolver;
            }
        }
    }
    return merged;
}

/** Merge authz contributions into a single tables snapshot. */
export function composedAuthz(): Required<FeatureAuthzContribution> {
    const tables: Required<FeatureAuthzContribution> = {
        mutationRequirements: {},
        queryRequirements: {},
        sessionInjected: [],
        customerSessionInjected: [],
        customerMutations: [],
        customerQueries: [],
        anonOpenMutations: [],
        capabilities: {},
        resourceGated: {},
    };
    const sessionInjected = new Set<string>();
    const customerSessionInjected = new Set<string>();
    const customerMutations = new Set<string>();
    const customerQueries = new Set<string>();
    const anonOpenMutations = new Set<string>();

    for (const f of activeFeatures()) {
        const c = f.authz;
        if (!c) continue;
        Object.assign(tables.mutationRequirements, c.mutationRequirements ?? {});
        Object.assign(tables.queryRequirements, c.queryRequirements ?? {});
        Object.assign(tables.capabilities, c.capabilities ?? {});
        Object.assign(tables.resourceGated, c.resourceGated ?? {});
        for (const m of c.sessionInjected ?? []) sessionInjected.add(m);
        for (const m of c.customerSessionInjected ?? []) customerSessionInjected.add(m);
        for (const m of c.customerMutations ?? []) customerMutations.add(m);
        for (const m of c.customerQueries ?? []) customerQueries.add(m);
        for (const m of c.anonOpenMutations ?? []) anonOpenMutations.add(m);
    }

    tables.sessionInjected = [...sessionInjected];
    tables.customerSessionInjected = [...customerSessionInjected];
    tables.customerMutations = [...customerMutations];
    tables.customerQueries = [...customerQueries];
    tables.anonOpenMutations = [...anonOpenMutations];
    return tables;
}

export {registry as featureRegistry};
