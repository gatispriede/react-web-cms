import {resolve} from "@services/api/generated";
import type {AuditEntry, AuditOp} from "@services/features/Audit/AuditService";
import {log} from "@services/infra/logger";

export interface AuditFilter {
    actorEmail?: string;
    collection?: string;
    docId?: string;
    op?: AuditOp;
    since?: string;
    until?: string;
    limit?: number;
    offset?: number;
}

export interface AuditPage {
    rows: AuditEntry[];
    total: number;
}

export class AuditApi {
    async list(filter: AuditFilter): Promise<AuditPage> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getAuditLog({filter}));
            if (!raw) return {rows: [], total: 0};
            const parsed = JSON.parse(raw);
            return {
                rows: Array.isArray(parsed?.rows) ? parsed.rows : [],
                total: typeof parsed?.total === 'number' ? parsed.total : 0,
            };
        } catch (err) {
            log.error({scope: 'audit.list', err}, 'audit list failed');
            return {rows: [], total: 0};
        }
    }

    async listCollections(): Promise<string[]> {
        // Direct-route bug: `gqty.resolve(({query}) => query.mongo.getAuditCollections)`
        // returns an empty payload on cold load (gqty client not always
        // hydrated). Raw POST always returns the correct String! payload.
        // `gqty.resolve` is reserved for SPA paths that pre-warmed the client.
        try {
            const r = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: `{ mongo { getAuditCollections } }`}),
            });
            const json = await r.json();
            const raw = json?.data?.mongo?.getAuditCollections;
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    async listActors(): Promise<string[]> {
        // Direct-route bug: `gqty.resolve(({query}) => query.mongo.getAuditActors)`
        // returns an empty payload on cold load (gqty client not always
        // hydrated). Raw POST always returns the correct String! payload.
        // `gqty.resolve` is reserved for SPA paths that pre-warmed the client.
        try {
            const r = await fetch('/api/graphql', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({query: `{ mongo { getAuditActors } }`}),
            });
            const json = await r.json();
            const raw = json?.data?.mongo?.getAuditActors;
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }
}

export default AuditApi;
