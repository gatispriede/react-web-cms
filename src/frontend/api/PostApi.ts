import {resolve} from "../gqty";
import {IPost, InPost} from "../../Interfaces/IPost";

export class PostApi {
    async list({includeDrafts = false, limit = 50}: {includeDrafts?: boolean; limit?: number} = {}): Promise<IPost[]> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getPosts({includeDrafts, limit}));
            return raw ? JSON.parse(raw) : [];
        } catch (err) {
            console.error('PostApi.list:', err);
            return [];
        }
    }

    async getBySlug(slug: string, includeDrafts = false): Promise<IPost | null> {
        try {
            const raw = await resolve(({query}) => (query as any).mongo.getPost({slug, includeDrafts}));
            return raw ? JSON.parse(raw) : null;
        } catch (err) {
            console.error('PostApi.getBySlug:', err);
            return null;
        }
    }

    async save(post: InPost): Promise<{id?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.savePost({post}));
            const parsed = JSON.parse(raw || '{}');
            return parsed.savePost ?? parsed;
        } catch (err) { return {error: String(err)}; }
    }

    async remove(id: string): Promise<{id?: string; deleted?: number; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.deletePost({id}));
            const parsed = JSON.parse(raw || '{}');
            return parsed.deletePost ?? parsed;
        } catch (err) { return {error: String(err)}; }
    }

    async setPublished(id: string, publish: boolean): Promise<{id?: string; draft?: boolean; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.setPostPublished({id, publish}));
            const parsed = JSON.parse(raw || '{}');
            return parsed.setPostPublished ?? parsed;
        } catch (err) { return {error: String(err)}; }
    }
}

export default PostApi;
