import {Collection, Db} from 'mongodb';
import {auditStamp} from './audit';

export type SiteLayoutMode = 'tabs' | 'scroll';

export interface ISiteFlags {
    blogEnabled: boolean;
    /** How the public site renders navigation: classic tab-per-page or a single
     *  stacked document with smooth-scroll anchors. */
    layoutMode: SiteLayoutMode;
}

export const DEFAULT_SITE_FLAGS: ISiteFlags = {
    blogEnabled: true,
    layoutMode: 'tabs',
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
            layoutMode: (value?.layoutMode === 'scroll' || value?.layoutMode === 'tabs')
                ? value.layoutMode
                : DEFAULT_SITE_FLAGS.layoutMode,
        };
    }

    async save(flags: Partial<ISiteFlags>, editedBy?: string): Promise<ISiteFlags> {
        const current = await this.get();
        const next: ISiteFlags = {
            blogEnabled: typeof flags.blogEnabled === 'boolean' ? flags.blogEnabled : current.blogEnabled,
            layoutMode: (flags.layoutMode === 'scroll' || flags.layoutMode === 'tabs')
                ? flags.layoutMode
                : current.layoutMode,
        };
        await this.settings.updateOne(
            {key: KEY},
            {$set: {key: KEY, value: next, ...auditStamp(editedBy)}},
            {upsert: true},
        );
        return next;
    }
}
