import {Collection, Db} from 'mongodb';
import {auditStamp} from './audit';
import {nextVersion, requireVersion} from './conflict';

export type SiteLayoutMode = 'tabs' | 'scroll';

export interface ISiteFlags {
    blogEnabled: boolean;
    /** How the public site renders navigation: classic tab-per-page or a single
     *  stacked document with smooth-scroll anchors. */
    layoutMode: SiteLayoutMode;
    /** When true, editors / admins get Alt-click inline translation editing on
     *  public-site strings. Off by default — Alt-click bindings can interfere
     *  with other testing flows, so editors opt in explicitly. */
    inlineTranslationEdit?: boolean;
    /** Auto-apply the `high-contrast` theme for visitors whose browser reports
     *  `prefers-contrast: more` or `forced-colors: active`. Off by default so
     *  the site owner opts into delegating their theme choice to the OS. */
    autoHighContrast?: boolean;
    /** When true, the public site routes Google Fonts traffic through the
     *  `/api/fonts/{css,file}` proxy so visitor IPs never reach
     *  `fonts.googleapis.com` / `fonts.gstatic.com`. GDPR-clean at the
     *  cost of a small proxy hop + longer first-paint on cold cache. */
    selfHostFonts?: boolean;
    version?: number;
    editedBy?: string;
    editedAt?: string;
}

export const DEFAULT_SITE_FLAGS: ISiteFlags = {
    blogEnabled: true,
    layoutMode: 'tabs',
    inlineTranslationEdit: false,
    autoHighContrast: false,
    selfHostFonts: false,
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
            inlineTranslationEdit: typeof value?.inlineTranslationEdit === 'boolean'
                ? value.inlineTranslationEdit
                : DEFAULT_SITE_FLAGS.inlineTranslationEdit,
            autoHighContrast: typeof value?.autoHighContrast === 'boolean'
                ? value.autoHighContrast
                : DEFAULT_SITE_FLAGS.autoHighContrast,
            selfHostFonts: typeof value?.selfHostFonts === 'boolean'
                ? value.selfHostFonts
                : DEFAULT_SITE_FLAGS.selfHostFonts,
            version: (doc as any)?.version ?? 0,
            editedBy: (doc as any)?.editedBy,
            editedAt: (doc as any)?.editedAt,
        };
    }

    async save(flags: Partial<ISiteFlags>, editedBy?: string, expectedVersion?: number | null): Promise<ISiteFlags> {
        const doc = await this.settings.findOne({key: KEY});
        const existingVersion = (doc as any)?.version as number | undefined;
        const current = await this.get();
        requireVersion(current, existingVersion, expectedVersion, 'Site flags');
        const next: ISiteFlags = {
            blogEnabled: typeof flags.blogEnabled === 'boolean' ? flags.blogEnabled : current.blogEnabled,
            layoutMode: (flags.layoutMode === 'scroll' || flags.layoutMode === 'tabs')
                ? flags.layoutMode
                : current.layoutMode,
            inlineTranslationEdit: typeof flags.inlineTranslationEdit === 'boolean'
                ? flags.inlineTranslationEdit
                : current.inlineTranslationEdit,
            autoHighContrast: typeof flags.autoHighContrast === 'boolean'
                ? flags.autoHighContrast
                : current.autoHighContrast,
            selfHostFonts: typeof flags.selfHostFonts === 'boolean'
                ? flags.selfHostFonts
                : current.selfHostFonts,
        };
        const version = nextVersion(existingVersion);
        await this.settings.updateOne(
            {key: KEY},
            {$set: {key: KEY, value: next, version, ...auditStamp(editedBy)}},
            {upsert: true},
        );
        return {...next, version};
    }
}
