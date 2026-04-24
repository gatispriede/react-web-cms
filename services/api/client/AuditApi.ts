import {resolve} from "@services/api/generated";
import type {AuditEntry, AuditOp} from "@services/features/Audit/AuditService";

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
            console.error('AuditApi.list:', err);
            return {rows: [], total: 0};
        }
    }

    async listCollections(): Promise<string[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getAuditCollections);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }

    async listActors(): Promise<string[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getAuditActors);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    }
}

export default AuditApi;
