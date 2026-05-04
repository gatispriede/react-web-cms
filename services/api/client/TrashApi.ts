import {resolve} from '@services/api/generated';
import {log} from '@services/infra/logger';

export interface TrashGroupSummary {
    trashGroup: string;
    deletedAt: string;
    summary: Record<string, number>;
}

export interface RestoreResult {
    trashGroup?: string;
    counts?: Record<string, number>;
    error?: string;
}

/** Thin GraphQL wrapper around the F2 trash admin surface. */
export class TrashApi {
    async list(): Promise<TrashGroupSummary[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getTrashGroups);
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            log.error({scope: 'trash.list', err}, 'trash list failed');
            return [];
        }
    }

    async restore(trashGroup: string): Promise<RestoreResult> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.restoreFromTrash({trashGroup}));
            const parsed = JSON.parse(raw || '{}');
            return parsed.restoreFromTrash ?? parsed;
        } catch (err) {
            log.error({scope: 'trash.restore', err, trashGroup}, 'trash restore failed');
            return {error: String(err)};
        }
    }
}

export default TrashApi;
