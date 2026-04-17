import {Collection, Db} from 'mongodb';

export interface ISiteFlags {
    blogEnabled: boolean;
}

export const DEFAULT_SITE_FLAGS: ISiteFlags = {
    blogEnabled: true,
};

const KEY = 'siteFlags';

export class SiteFlagsService {
    private settings: Collection;

    constructor(db: Db) {
        this.settings = db.collection('SiteSettings');
    }

    async get(): Promise<ISiteFlags> {
        const doc = await this.settings.findOne({key: KEY});
        const value = (doc as any)?.value as Partial<ISiteFlags> | undefined;
        return {
            blogEnabled: value?.blogEnabled ?? DEFAULT_SITE_FLAGS.blogEnabled,
        };
    }

    async save(flags: Partial<ISiteFlags>): Promise<ISiteFlags> {
        const current = await this.get();
        const next: ISiteFlags = {
            blogEnabled: typeof flags.blogEnabled === 'boolean' ? flags.blogEnabled : current.blogEnabled,
        };
        await this.settings.updateOne(
            {key: KEY},
            {$set: {key: KEY, value: next}},
            {upsert: true},
        );
        return next;
    }
}
