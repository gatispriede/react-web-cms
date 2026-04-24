import {Collection, Db} from 'mongodb';
import {DEFAULT_SITE_SEO, ISiteSeoDefaults} from '@interfaces/ISiteSeo';
import {auditStamp} from '@services/features/Audit/audit';
import {nextVersion, requireVersion} from '@services/infra/conflict';

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
            version: (doc as any)?.version ?? 0,
            editedBy: (doc as any)?.editedBy,
            editedAt: (doc as any)?.editedAt,
        };
    }

    async save(seo: ISiteSeoDefaults, editedBy?: string, expectedVersion?: number | null): Promise<ISiteSeoDefaults> {
        const existing = await this.settings.findOne({key: KEY});
        const existingVersion = (existing as any)?.version as number | undefined;
        requireVersion(await this.get(), existingVersion, expectedVersion, 'Site SEO');
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
        const version = nextVersion(existingVersion);
        await this.settings.updateOne(
            {key: KEY},
            {$set: {key: KEY, value: sanitized, version, ...auditStamp(editedBy)}},
            {upsert: true},
        );
        return {...sanitized, version};
    }
}
