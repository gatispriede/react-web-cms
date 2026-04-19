import {Collection, Db} from 'mongodb';
import {DEFAULT_SITE_SEO, ISiteSeoDefaults} from '../Interfaces/ISiteSeo';
import {auditStamp} from './audit';

const KEY = 'siteSeo';

const clip = (v: unknown, max: number): string | undefined =>
    typeof v === 'string' ? v.slice(0, max) : undefined;

export class SiteSeoService {
    private settings: Collection;

    constructor(db: Db) {
        this.settings = db.collection('SiteSettings');
    }

    async get(): Promise<ISiteSeoDefaults> {
        const doc = await this.settings.findOne({key: KEY});
        const value = (doc as any)?.value as ISiteSeoDefaults | undefined;
        return {
            ...(value ?? DEFAULT_SITE_SEO),
            editedBy: (doc as any)?.editedBy,
            editedAt: (doc as any)?.editedAt,
        };
    }

    async save(seo: ISiteSeoDefaults, editedBy?: string): Promise<ISiteSeoDefaults> {
        const sanitized: ISiteSeoDefaults = {
            siteName: clip(seo.siteName, 120),
            defaultDescription: clip(seo.defaultDescription, 500),
            defaultKeywords: clip(seo.defaultKeywords, 500),
            defaultImage: clip(seo.defaultImage, 500),
            primaryDomain: clip(seo.primaryDomain, 200),
            twitterHandle: clip(seo.twitterHandle, 40),
            defaultAuthor: clip(seo.defaultAuthor, 120),
            defaultLocale: clip(seo.defaultLocale, 12),
        };
        await this.settings.updateOne(
            {key: KEY},
            {$set: {key: KEY, value: sanitized, ...auditStamp(editedBy)}},
            {upsert: true},
        );
        return sanitized;
    }
}
