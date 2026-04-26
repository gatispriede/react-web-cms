import {Collection, Db} from 'mongodb';
import {auditStamp} from '@services/features/Audit/audit';
import {nextVersion, requireVersion} from '@services/infra/conflict';

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
    /** Where the public-site contact form ("Send a brief") delivers
     *  submissions. Configurable in the admin so the operator can swap
     *  inboxes without redeploying. Falls back to the default below if
     *  unset. The actual SMTP credentials live in env (`SMTP_HOST`,
     *  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`). */
    inquiryRecipientEmail?: string;
    /** Master toggle for the inquiry form. When false, the API rejects
     *  submissions with 503 and the form's submit button is disabled. */
    inquiryEnabled?: boolean;
    /** Lifetime quota for a single client IP. Once `Inquiries`-collection
     *  count for that IP reaches this number the API returns 429. Default
     *  3 — enough for legitimate visitors but blunts the abuse case where
     *  a single IP bombards the form. Set to 0 to disable the per-client
     *  cap entirely (the per-window rate-limiter still applies). */
    inquiryMaxPerClient?: number;
    /** Comma-separated list of origins allowed to POST to `/api/inquiry`.
     *  Empty / unset = fall back to same-origin (request `Origin` matches
     *  request `Host`). Set explicitly when the same image runs on
     *  multiple deployments and you want to lock submissions to one
     *  canonical domain. Example: `https://funisimo.pro,https://www.funisimo.pro`. */
    inquiryAllowedOrigins?: string;
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
    inquiryRecipientEmail: 'gatiss.priede@inbox.lv',
    inquiryEnabled: true,
    inquiryMaxPerClient: 3,
    inquiryAllowedOrigins: '',
};

/** Light validation — keeps obviously-broken values from being saved.
 *  Empty string is allowed (resets to default at read time). */
const isPlausibleEmail = (s: unknown): s is string =>
    typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Clamp the per-client quota to something sensible. Negative values
 *  collapse to 0 (cap disabled), and absurdly high numbers are capped at
 *  100 so an admin typo doesn't render the cap meaningless. */
const sanitizeMaxPerClient = (n: unknown): number => {
    const x = typeof n === 'number' ? n : Number(n);
    if (!Number.isFinite(x) || x < 0) return 0;
    return Math.min(Math.floor(x), 100);
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
            inquiryRecipientEmail: isPlausibleEmail(value?.inquiryRecipientEmail)
                ? value!.inquiryRecipientEmail
                : DEFAULT_SITE_FLAGS.inquiryRecipientEmail,
            inquiryEnabled: typeof value?.inquiryEnabled === 'boolean'
                ? value.inquiryEnabled
                : DEFAULT_SITE_FLAGS.inquiryEnabled,
            inquiryMaxPerClient: typeof value?.inquiryMaxPerClient === 'number'
                ? sanitizeMaxPerClient(value.inquiryMaxPerClient)
                : DEFAULT_SITE_FLAGS.inquiryMaxPerClient,
            inquiryAllowedOrigins: typeof value?.inquiryAllowedOrigins === 'string'
                ? value.inquiryAllowedOrigins
                : DEFAULT_SITE_FLAGS.inquiryAllowedOrigins,
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
            // Empty string is permitted on input — the read-side logic
            // falls back to the default email when the stored value is
            // not a plausible email shape, so an editor can "clear" the
            // field and have it revert without an extra UI gesture.
            inquiryRecipientEmail: isPlausibleEmail(flags.inquiryRecipientEmail)
                ? flags.inquiryRecipientEmail
                : (flags.inquiryRecipientEmail === ''
                    ? DEFAULT_SITE_FLAGS.inquiryRecipientEmail
                    : current.inquiryRecipientEmail),
            inquiryEnabled: typeof flags.inquiryEnabled === 'boolean'
                ? flags.inquiryEnabled
                : current.inquiryEnabled,
            inquiryMaxPerClient: typeof flags.inquiryMaxPerClient === 'number'
                ? sanitizeMaxPerClient(flags.inquiryMaxPerClient)
                : current.inquiryMaxPerClient,
            inquiryAllowedOrigins: typeof flags.inquiryAllowedOrigins === 'string'
                ? flags.inquiryAllowedOrigins.trim()
                : current.inquiryAllowedOrigins,
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
