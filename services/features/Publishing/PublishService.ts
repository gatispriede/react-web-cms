import {Collection, Db} from 'mongodb';
import guid from '@utils/guid';

export interface SnapshotMeta {
    id: string;
    publishedAt: string;
    publishedBy?: string;
    note?: string;
    rolledBackFrom?: string;
}

export interface SnapshotData {
    navigation: any[];
    sections: any[];
    languages: any[];
    logo: any | null;
    images: any[];
    posts?: any[];
}

export interface PublishedSnapshot extends SnapshotMeta, SnapshotData {}

export class PublishService {
    private db: Db;
    private snapshots: Collection;

    constructor(db: Db) {
        this.db = db;
        this.snapshots = db.collection('PublishedSnapshots');
    }

    async publishSnapshot(publishedBy?: string, note?: string): Promise<SnapshotMeta> {
        const [navigation, sections, languages, logo, images, posts] = await Promise.all([
            this.db.collection('Navigation').find({}).toArray(),
            this.db.collection('Sections').find({}).toArray(),
            this.db.collection('Languages').find({}).toArray(),
            this.db.collection('Logos').findOne({}),
            this.db.collection('Images').find({}).toArray(),
            this.db.collection('Posts').find({draft: {$ne: true}}).toArray(),
        ]);
        const strip = (d: any) => {
            const {_id, ...rest} = d ?? {};
            return rest;
        };
        const doc: PublishedSnapshot = {
            id: guid(),
            publishedAt: new Date().toISOString(),
            publishedBy,
            note,
            navigation: navigation.map(strip),
            sections: sections.map(strip),
            languages: languages.map(strip),
            logo: logo ? strip(logo) : null,
            images: images.map(strip),
            posts: posts.map(strip),
        };
        await this.snapshots.insertOne(doc as any);
        return this.toMeta(doc);
    }

    async getActiveSnapshot(): Promise<PublishedSnapshot | null> {
        const doc = await this.snapshots
            .find({}, {projection: {_id: 0}})
            .sort({publishedAt: -1})
            .limit(1)
            .next();
        return (doc as unknown as PublishedSnapshot) ?? null;
    }

    async getActiveMeta(): Promise<SnapshotMeta | null> {
        const doc = await this.snapshots
            .find({}, this.metaProjection())
            .sort({publishedAt: -1})
            .limit(1)
            .next();
        return doc ? this.toMeta(doc) : null;
    }

    async getHistory(limit = 50): Promise<SnapshotMeta[]> {
        const cap = Math.max(1, Math.min(200, Math.floor(limit) || 50));
        const docs = await this.snapshots
            .find({}, this.metaProjection())
            .sort({publishedAt: -1})
            .limit(cap)
            .toArray();
        return docs.map(d => this.toMeta(d));
    }

    async rollbackTo(id: string, publishedBy?: string): Promise<SnapshotMeta> {
        const source = await this.snapshots.findOne({id}, {projection: {_id: 0}});
        if (!source) throw new Error('Snapshot not found');
        const src = source as unknown as PublishedSnapshot;
        const doc: PublishedSnapshot = {
            id: guid(),
            publishedAt: new Date().toISOString(),
            publishedBy,
            note: `Rollback to ${src.publishedAt}${src.note ? ` — ${src.note}` : ''}`,
            rolledBackFrom: id,
            navigation: src.navigation,
            sections: src.sections,
            languages: src.languages,
            logo: src.logo,
            images: src.images,
            posts: src.posts ?? [],
        };
        await this.snapshots.insertOne(doc as any);
        return this.toMeta(doc);
    }

    private metaProjection() {
        return {projection: {_id: 0, id: 1, publishedAt: 1, publishedBy: 1, note: 1, rolledBackFrom: 1}};
    }

    private toMeta(d: any): SnapshotMeta {
        return {
            id: d.id,
            publishedAt: d.publishedAt,
            publishedBy: d.publishedBy,
            note: d.note,
            rolledBackFrom: d.rolledBackFrom,
        };
    }
}
