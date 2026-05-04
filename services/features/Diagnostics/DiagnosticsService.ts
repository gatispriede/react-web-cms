import type {Db} from 'mongodb';
import type {RedisLike} from '@services/infra/redis';
import {bootId, uptimeMs} from '@services/infra/bootId';
import {getIdempotencyService, IdempotencyService} from '@services/infra/idempotency';
import {log} from '@services/infra/logger';
import type {FeatureManifest} from '@services/infra/featureManifest';

/**
 * F5 — Diagnostics composer. Reads existing infra (feature registry,
 * Mongo connection, Redis, idempotency, permissions) and folds it into
 * one JSON-serialisable snapshot the admin UI renders. Admin-only.
 *
 * No env-secret bleed: only `NODE_ENV` and `DEPLOY_TIER` are surfaced;
 * URI-shaped vars (`MONGO_URI`, `REDIS_URL`, `*_KEY`, `*_TOKEN`,
 * `*_SECRET`, `*_PASSWORD`) are NEVER read here. Build identity comes
 * from the deploy-stamped `GIT_SHA` / `BUILD_TS` / `ACTIVE_UPSTREAM`.
 *
 * Trash + idempotency stats are counts only (no row contents, no
 * actual key strings — those would leak user identifiers).
 *
 * Authz snapshot returns aggregate counts grouped by scope; never user
 * names or emails.
 */

export interface BuildIdentity {
    readonly gitSha: string;
    readonly buildTimestamp: string | null;
    readonly activeUpstream: string;
    readonly bootId: string;
    readonly uptimeMs: number;
    readonly nodeEnv: string;
    readonly deployTier: string;
}

export interface FeatureSummary {
    readonly id: string;
    readonly displayName: string;
    readonly enabled: boolean;
    readonly coreInfrastructure: boolean;
    readonly mutationCount: number;
    readonly queryCount: number;
    readonly gatedMutationCount: number;
    readonly cascadeRuleCount: number;
}

export interface StorageHealth {
    readonly mongo: {connected: boolean; replicaSet: boolean; transactionsSupported: boolean};
    readonly redis: {available: boolean; dbSize: number | null};
    readonly cacheVersions: Record<string, number>;
}

export interface TrashOverview {
    readonly collection: string;
    readonly rowCount: number;
    readonly oldestDeletedAt: string | null;
    readonly distinctTrashGroups: number;
}

export interface IdempotencyStats {
    readonly inFlight: number;
    readonly ttlSeconds: number;
}

export interface AuthorizationSnapshot {
    readonly grantsByScope: Record<string, number>;
    readonly functionalRolesRegistered: number;
    readonly grantTotal: number;
}

export interface DiagnosticsSnapshot {
    readonly build: BuildIdentity;
    readonly features: readonly FeatureSummary[];
    readonly storage: StorageHealth;
    readonly trash: readonly TrashOverview[];
    readonly idempotency: IdempotencyStats;
    readonly authorization: AuthorizationSnapshot;
    readonly generatedAt: string;
}

export interface DiagnosticsDeps {
    readonly db: Db;
    readonly redis: RedisLike | null;
    readonly featureRegistry: readonly FeatureManifest[];
    readonly resolveEnabled: (m: FeatureManifest) => boolean;
    readonly composedFunctionalRoles: () => readonly {id: string}[];
    readonly idempotency: IdempotencyService;
    readonly mongoClientOptions?: Record<string, unknown>;
}

const TTL_DEFAULT = 300;

function readBuildIdentity(): BuildIdentity {
    return {
        gitSha: process.env.GIT_SHA ?? 'unknown',
        buildTimestamp: process.env.BUILD_TS ?? null,
        activeUpstream: process.env.ACTIVE_UPSTREAM ?? 'unknown',
        bootId,
        uptimeMs: uptimeMs(),
        nodeEnv: process.env.NODE_ENV ?? 'development',
        deployTier: process.env.DEPLOY_TIER ?? 'unknown',
    };
}

function summarizeFeature(f: FeatureManifest, enabled: boolean): FeatureSummary {
    const resolvers = (f.resolvers ?? {}) as Record<string, Record<string, unknown>>;
    const queryCount = Object.keys(resolvers.QueryMongo ?? resolvers.Query ?? {}).length;
    const mutationCount = Object.keys(resolvers.MutationMongo ?? resolvers.Mutation ?? {}).length;
    const sdl = f.schemaSDL ?? '';
    // SDL fragments are the source of truth for query/mutation surface
    // (resolvers may live on the connection delegate, not the manifest).
    // Count `extend type QueryMongo {...}` / `extend type MutationMongo
    // {...}` field declarations.
    const sdlQueryCount = countSdlFields(sdl, 'QueryMongo');
    const sdlMutationCount = countSdlFields(sdl, 'MutationMongo');
    const authz = f.authz;
    const gatedMutationCount = Object.keys(authz?.mutationRequirements ?? {}).length;
    return {
        id: f.id,
        displayName: f.displayName,
        enabled,
        coreInfrastructure: Boolean(f.coreInfrastructure),
        mutationCount: Math.max(mutationCount, sdlMutationCount),
        queryCount: Math.max(queryCount, sdlQueryCount),
        gatedMutationCount,
        cascadeRuleCount: (f.cascadeRules ?? []).length,
    };
}

function countSdlFields(sdl: string, typeName: string): number {
    const re = new RegExp(`extend\\s+type\\s+${typeName}\\s*\\{([\\s\\S]*?)\\}`, 'g');
    let total = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sdl)) !== null) {
        const body = m[1];
        // Strip block comments / triple-quoted docstrings, then count
        // top-level field names — `name(...): Type` or `name: Type`.
        // Multiple fields on one line are valid SDL; the per-field regex
        // catches each occurrence (not just line-anchored ones).
        const stripped = body.replace(/"""[\s\S]*?"""/g, '');
        const matches = stripped.match(/[a-zA-Z_][a-zA-Z0-9_]*\s*(?:\([^)]*\))?\s*:/g);
        total += matches?.length ?? 0;
    }
    return total;
}

async function readStorageHealth(deps: DiagnosticsDeps): Promise<StorageHealth> {
    const opts = deps.mongoClientOptions ?? {};
    const replicaSet = Boolean((opts as {replicaSet?: string}).replicaSet);
    let mongoConnected = false;
    try {
        await deps.db.command({ping: 1});
        mongoConnected = true;
    } catch (err) {
        log.warn({scope: 'diagnostics.mongo.ping', err}, 'mongo ping failed');
    }
    let redisAvailable = false;
    let dbSize: number | null = null;
    if (deps.redis) {
        try {
            // Redis reachability probe — a get on a known-absent key.
            await deps.redis.get('cms:diagnostics:probe');
            redisAvailable = true;
        } catch (err) {
            log.warn({scope: 'diagnostics.redis.probe', err}, 'redis probe failed');
        }
    }
    let cacheVersions: Record<string, number> = {};
    try {
        const {composedCacheVersionKeys} = await import('@services/infra/featureRegistry');
        const {getFeatureVersions} = await import('@services/infra/cacheVersion');
        const map = composedCacheVersionKeys();
        const allKeys = Array.from(new Set(Object.values(map).flat()));
        cacheVersions = await getFeatureVersions(allKeys);
    } catch (err) {
        log.warn({scope: 'diagnostics.cv', err}, 'cache version snapshot failed');
    }
    return {
        mongo: {connected: mongoConnected, replicaSet, transactionsSupported: replicaSet},
        redis: {available: redisAvailable, dbSize},
        cacheVersions,
    };
}

async function readTrashOverview(db: Db): Promise<TrashOverview[]> {
    try {
        const all = await db.listCollections({}, {nameOnly: true}).toArray();
        const trashCols = all.filter(c => typeof c.name === 'string' && c.name.endsWith('.trash'));
        const out: TrashOverview[] = [];
        for (const c of trashCols) {
            const col = db.collection(c.name);
            const rowCount = await col.countDocuments({});
            const oldestDoc = await col.find({}).sort({deletedAt: 1}).limit(1).toArray();
            const oldestDeletedAt = oldestDoc[0]?.deletedAt instanceof Date
                ? (oldestDoc[0].deletedAt as Date).toISOString()
                : (typeof oldestDoc[0]?.deletedAt === 'string' ? oldestDoc[0].deletedAt : null);
            const groups = await col.distinct('trashGroup');
            out.push({
                collection: c.name,
                rowCount,
                oldestDeletedAt,
                distinctTrashGroups: Array.isArray(groups) ? groups.length : 0,
            });
        }
        return out.sort((a, b) => a.collection.localeCompare(b.collection));
    } catch (err) {
        log.warn({scope: 'diagnostics.trash', err}, 'trash overview failed');
        return [];
    }
}

function readIdempotencyStats(svc: IdempotencyService): IdempotencyStats {
    const stats = svc.stats?.() ?? {inFlight: 0, ttlSeconds: TTL_DEFAULT};
    return {inFlight: stats.inFlight, ttlSeconds: stats.ttlSeconds};
}

async function readAuthorizationSnapshot(deps: DiagnosticsDeps): Promise<AuthorizationSnapshot> {
    let grantTotal = 0;
    const grantsByScope: Record<string, number> = {};
    try {
        const col = deps.db.collection('Permissions');
        const rows = await col.aggregate([
            {$group: {_id: '$scope', n: {$sum: 1}}},
        ]).toArray();
        for (const r of rows) {
            const scope = String(r._id ?? 'unknown');
            const n = Number(r.n) || 0;
            grantsByScope[scope] = n;
            grantTotal += n;
        }
    } catch (err) {
        log.warn({scope: 'diagnostics.authz', err}, 'permissions aggregate failed');
    }
    let functionalRolesRegistered = 0;
    try {
        functionalRolesRegistered = deps.composedFunctionalRoles().length;
    } catch { /* roles surface optional */ }
    return {grantsByScope, functionalRolesRegistered, grantTotal};
}

export async function composeDiagnostics(deps: DiagnosticsDeps): Promise<DiagnosticsSnapshot> {
    const features = deps.featureRegistry.map(f => summarizeFeature(f, deps.resolveEnabled(f)));
    const [storage, trash, authorization] = await Promise.all([
        readStorageHealth(deps),
        readTrashOverview(deps.db),
        readAuthorizationSnapshot(deps),
    ]);
    return {
        build: readBuildIdentity(),
        features,
        storage,
        trash,
        idempotency: readIdempotencyStats(deps.idempotency),
        authorization,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Service-class shell. Holds the deps; the loader hands one instance
 * onto `featureServices.diagnostics` and the connection delegate calls
 * `service.snapshot()` to fulfil the `getDiagnostics` query.
 */
export class DiagnosticsService {
    constructor(private readonly db: Db, private readonly redis: RedisLike | null) {}

    async snapshot(): Promise<DiagnosticsSnapshot> {
        // Lazy imports — `featureRegistry` pulls every feature manifest,
        // which would create a startup cycle if imported at the top of
        // this file (DiagnosticsService is itself a feature).
        const {featureRegistry, resolveEnabled, composedFunctionalRoles} =
            await import('@services/infra/featureRegistry');
        let mongoClientOptions: Record<string, unknown> | undefined;
        try {
            const {getMongoConnection} = await import('@services/infra/mongoDBConnection');
            const conn = getMongoConnection();
            // The driver carries replica-set / TLS / auth config under
            // `client.options`. We only read `replicaSet` (a string id);
            // never `auth`, `credentials`, or `tls.*` paths.
            mongoClientOptions = (conn as unknown as {client?: {options?: Record<string, unknown>}}).client?.options;
        } catch { /* connection optional in tests */ }
        return composeDiagnostics({
            db: this.db,
            redis: this.redis,
            featureRegistry,
            resolveEnabled,
            composedFunctionalRoles,
            idempotency: getIdempotencyService(),
            mongoClientOptions,
        });
    }
}
