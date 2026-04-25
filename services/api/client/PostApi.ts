import {resolve} from "@services/api/generated";
import {IPost, InPost} from "@interfaces/IPost";
import {refreshBus} from "@client/lib/refreshBus";
import {triggerRevalidate} from "@client/lib/triggerRevalidate";
import {isConflictError, parseMutationResponse} from "@client/lib/conflict";

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

    async save(post: InPost, expectedVersion?: number | null): Promise<{id?: string; version?: number; slug?: string; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.savePost({
                post,
                ...(expectedVersion != null ? {expectedVersion} : {}),
            }));
            const parsed: any = parseMutationResponse(raw);
            const result = parsed.savePost ?? parsed;
            refreshBus.emit('settings');
            // The server may have renamed the slug (collision-bump) — its
            // response carries the authoritative `slug`. Revalidate the
            // page at the FINAL slug, and if the input slug differs, also
            // revalidate the input path so a stale ISR snapshot at the
            // requested slug doesn't keep serving the old body.
            const finalSlug = result?.slug || post?.slug;
            if (finalSlug) triggerRevalidate({scope: 'post', slug: finalSlug});
            if (post?.slug && finalSlug && post.slug !== finalSlug) {
                triggerRevalidate({scope: 'post', slug: post.slug});
            }
            if (!finalSlug) triggerRevalidate({scope: 'blog'});
            return result;
        } catch (err) {
            if (isConflictError(err)) throw err;
            return {error: String(err)};
        }
    }

    async remove(id: string): Promise<{id?: string; deleted?: number; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.deletePost({id}));
            const parsed = JSON.parse(raw || '{}');
            refreshBus.emit('settings');
            // Delete removes a `/blog/<slug>` path — regenerating /blog
            // is the best we can do without the caller supplying the
            // slug; the deleted post's own path will 404 naturally.
            triggerRevalidate({scope: 'blog'});
            return parsed.deletePost ?? parsed;
        } catch (err) { return {error: String(err)}; }
    }

    async setPublished(id: string, publish: boolean): Promise<{id?: string; draft?: boolean; error?: string}> {
        try {
            const raw = await resolve(({mutation}) => (mutation as any).mongo.setPostPublished({id, publish}));
            const parsed = JSON.parse(raw || '{}');
            refreshBus.emit('settings');
            // Publish toggle flips whether the post appears on /blog — we
            // don't have the slug here, so regenerate the index only.
            triggerRevalidate({scope: 'blog'});
            return parsed.setPostPublished ?? parsed;
        } catch (err) { return {error: String(err)}; }
    }
}

export default PostApi;
