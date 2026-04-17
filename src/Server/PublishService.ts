import {Collection, Db} from 'mongodb';
import guid from '../helpers/guid';

export interface SnapshotMeta {
    id: string;
    publishedAt: string;
    publishedBy?: string;
}

export interface SnapshotData {
    navigation: any[];
    sections: any[];
    languages: any[];
    logo: any | null;
    images: any[];
}

export interface PublishedSnapshot extends SnapshotMeta, SnapshotData {}

export class PublishService {
    private db: Db;
    private snapshots: Collection;

    constructor(db: Db) {
        this.db = db;
        this.snapshots = db.collection('PublishedSnapshots');
    }

    async publishSnapshot(publishedBy?: string): Promise<SnapshotMeta> {
        const [navigation, sections, languages, logo, images] = await Promise.all([
            this.db.collection('Navigation').find({}).toArray(),
            this.db.collection('Sections').find({}).toArray(),
            this.db.collection('Languages').find({}).toArray(),
            this.db.collection('Logos').findOne({}),
            this.db.collection('Images').find({}).toArray(),
        ]);
        const strip = (d: any) => {
            const {_id, ...rest} = d ?? {};
            return rest;
        };
        const doc: PublishedSnapshot = {
            id: guid(),
            publishedAt: new Date().toISOString(),
            publishedBy,
            navigation: navigation.map(strip),
            sections: sections.map(strip),
            languages: languages.map(strip),
            logo: logo ? strip(logo) : null,
            images: images.map(strip),
        };
        await this.snapshots.insertOne(doc as any);
        return {id: doc.id, publishedAt: doc.publishedAt, publishedBy: doc.publishedBy};
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
            .find({}, {projection: {_id: 0, id: 1, publishedAt: 1, publishedBy: 1}})
            .sort({publishedAt: -1})
            .limit(1)
            .next();
        return (doc as unknown as SnapshotMeta) ?? null;
    }
}
