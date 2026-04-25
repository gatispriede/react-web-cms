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
        const raw = (doc as any)?.value as Record<string, any> | undefined;
        // Normalize legacy / bundle-imported shapes onto the form schema.
        // Prod imports historically wrote `siteSeo` using the per-page SEO
        // shape (`title`, `description`, `keywords[]`, `image`, `author`,
        // `locale`, `url`) — when the admin form then asked for
        // `siteName`, `defaultDescription`, etc. it found nothing and rendered
        // empty fields even though rich data was present. This shim keeps
        // both shapes readable; the next save canonicalizes to the form
        // shape via `save()` below.
        const value: ISiteSeoDefaults = (() => {
            if (!raw) return {...DEFAULT_SITE_SEO};
            const v: ISiteSeoDefaults = {
                siteName: raw.siteName ?? raw.title,
                defaultDescription: raw.defaultDescription ?? raw.description,
                defaultKeywords: raw.defaultKeywords ?? (
                    Array.isArray(raw.keywords) ? raw.keywords.join(', ') : raw.keywords
                ),
                defaultImage: raw.defaultImage ?? raw.image,
                defaultAuthor: raw.defaultAuthor ?? raw.author,
                defaultLocale: raw.defaultLocale ?? raw.locale,
                twitterHandle: raw.twitterHandle,
                primaryDomain: raw.primaryDomain ?? (() => {
                    // Per-page SEO `url` is a full page URL; we want just the
                    // origin for the site-wide default. Best-effort parse —
                    // if URL parsing fails, drop it rather than poisoning the
                    // form with `https://example.com/some/path`.
                    if (typeof raw.url !== 'string' || !raw.url) return undefined;
                    try { return new URL(raw.url).origin; } catch { return undefined; }
                })(),
            };
            // Strip undefined so DEFAULT_SITE_SEO can fall through cleanly.
            return Object.fromEntries(Object.entries(v).filter(([, x]) => x != null)) as ISiteSeoDefaults;
        })();
        return {
            ...value,
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
