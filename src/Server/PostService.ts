import {Collection, Db} from 'mongodb';
import guid from '../helpers/guid';
import {IPost, InPost} from '../Interfaces/IPost';

const slugify = (s: string) =>
    (s || '').toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 80);

export class PostService {
    private posts: Collection;

    constructor(db: Db) {
        this.posts = db.collection('Posts');
    }

    async list({includeDrafts = false, limit = 50}: {includeDrafts?: boolean; limit?: number} = {}): Promise<IPost[]> {
        const cap = Math.max(1, Math.min(500, Math.floor(limit) || 50));
        const query = includeDrafts ? {} : {draft: {$ne: true}};
        const docs = await this.posts
            .find(query, {projection: {_id: 0}})
            .sort({publishedAt: -1, createdAt: -1})
            .limit(cap)
            .toArray();
        return docs.map(d => this.normalize(d));
    }

    async getBySlug(slug: string, {includeDrafts = false}: {includeDrafts?: boolean} = {}): Promise<IPost | null> {
        const query: any = {slug};
        if (!includeDrafts) query.draft = {$ne: true};
        const doc = await this.posts.findOne(query, {projection: {_id: 0}});
        return doc ? this.normalize(doc) : null;
    }

    async getById(id: string): Promise<IPost | null> {
        const doc = await this.posts.findOne({id}, {projection: {_id: 0}});
        return doc ? this.normalize(doc) : null;
    }

    async save(post: InPost, editedBy?: string): Promise<{id: string}> {
        const title = (post.title || '').trim();
        if (!title) throw new Error('title is required');
        const now = new Date().toISOString();
        let slug = (post.slug || slugify(title)).trim();
        if (!slug) slug = slugify(title) || guid().slice(0, 8);
        // slug uniqueness
        const collision = await this.posts.findOne({slug, id: {$ne: post.id ?? ''}});
        if (collision) slug = `${slug}-${Date.now().toString(36)}`;
        if (post.id) {
            const existing = await this.posts.findOne({id: post.id});
            if (!existing) throw new Error('post not found');
            const update: Partial<IPost> & {editedBy?: string} = {
                slug,
                title,
                excerpt: post.excerpt ?? '',
                coverImage: post.coverImage,
                tags: post.tags ?? [],
                author: post.author,
                draft: post.draft ?? (existing as any).draft ?? false,
                body: post.body ?? '',
                updatedAt: now,
            };
            if (editedBy) update.editedBy = editedBy;
            if (post.publishedAt !== undefined) update.publishedAt = post.publishedAt;
            if (update.draft === false && !(existing as any).publishedAt) update.publishedAt = now;
            await this.posts.updateOne({id: post.id}, {$set: update});
            return {id: post.id};
        }
        const id = guid();
        const draft = post.draft ?? false;
        const doc: IPost & {editedBy?: string} = {
            id,
            slug,
            title,
            excerpt: post.excerpt ?? '',
            coverImage: post.coverImage,
            tags: post.tags ?? [],
            author: post.author,
            publishedAt: post.publishedAt ?? (draft ? undefined : now),
            draft,
            body: post.body ?? '',
            createdAt: now,
            updatedAt: now,
            ...(editedBy ? {editedBy} : {}),
        };
        await this.posts.insertOne(doc as any);
        return {id};
    }

    async remove(id: string, deletedBy?: string): Promise<{id: string; deleted: number; deletedBy?: string}> {
        const result = await this.posts.deleteOne({id});
        return {id, deleted: result.deletedCount ?? 0, ...(deletedBy ? {deletedBy} : {})};
    }

    async setPublished(id: string, publish: boolean, editedBy?: string): Promise<{id: string; draft: boolean}> {
        const existing = await this.posts.findOne({id});
        if (!existing) throw new Error('post not found');
        const update: any = {draft: !publish, updatedAt: new Date().toISOString()};
        if (editedBy) update.editedBy = editedBy;
        if (publish && !(existing as any).publishedAt) update.publishedAt = new Date().toISOString();
        await this.posts.updateOne({id}, {$set: update});
        return {id, draft: update.draft};
    }

    private normalize(d: any): IPost {
        return {
            id: d.id,
            slug: d.slug,
            title: d.title ?? '',
            excerpt: d.excerpt ?? '',
            coverImage: d.coverImage,
            tags: Array.isArray(d.tags) ? d.tags : [],
            author: d.author,
            publishedAt: d.publishedAt,
            draft: Boolean(d.draft),
            body: d.body ?? '',
            createdAt: d.createdAt ?? '',
            updatedAt: d.updatedAt ?? '',
            editedBy: d.editedBy,
            editedAt: d.editedAt ?? d.updatedAt,
        };
    }
}
