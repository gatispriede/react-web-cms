import {resolve} from "../gqty";
import type {PublishedSnapshot, SnapshotMeta} from "../../Server/PublishService";

export class PublishApi {
    async publish(): Promise<{id?: string; publishedAt?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.publishSnapshot);
            const parsed = JSON.parse(raw || '{}');
            return parsed.publishSnapshot ?? parsed;
        } catch (err) {
            return {error: String(err)};
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
