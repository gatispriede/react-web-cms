import {resolve} from "@services/api/generated";
import type {PublishedSnapshot, SnapshotMeta} from "@services/features/Publishing/PublishService";

export class PublishApi {
    async publish(note?: string): Promise<SnapshotMeta & {error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.publishSnapshot({note}));
            const parsed = JSON.parse(raw || '{}');
            return parsed.publishSnapshot ?? parsed;
        } catch (err) {
            return {error: String(err)} as any;
        }
    }

    async rollback(id: string): Promise<SnapshotMeta & {error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.rollbackToSnapshot({id}));
            const parsed = JSON.parse(raw || '{}');
            return parsed.rollbackToSnapshot ?? parsed;
        } catch (err) {
            return {error: String(err)} as any;
        }
    }

    async getHistory(limit = 50): Promise<SnapshotMeta[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getPublishedHistory({limit}));
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            console.error('getHistory:', err);
            return [];
        }
    }

    async getSnapshot(): Promise<PublishedSnapshot | null> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getPublishedSnapshot);
            if (!raw) return null;
            return JSON.parse(raw) as PublishedSnapshot;
        } catch (err) {
            console.error('Error reading snapshot:', err);
            return null;
        }
    }

    async getMeta(): Promise<SnapshotMeta | null> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getPublishedMeta);
            if (!raw) return null;
            return JSON.parse(raw) as SnapshotMeta;
        } catch (err) {
            return null;
        }
    }
}

export default PublishApi;
