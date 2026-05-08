import {Collection, Db} from 'mongodb';
import {auditStamp} from '@services/features/Audit/audit';
import {nextVersion, requireVersion} from '@services/infra/conflict';
import {encrypt as secretBoxEncrypt} from '@services/infra/secretBox';

export type SiteLayoutMode = 'tabs' | 'scroll' | 'auto';

/**
 * Resolve `'auto'` to a concrete render mode. Per the F6 spec
 * (`docs/roadmap/site-mode-toggle.md`): default `auto` → `'tabs'`
 * because every existing production site runs in multi-page tabs
 * mode (F1 sub-pages is the live shape). Operators on legacy
 * scroll-era bundles opt explicitly into `'scroll'`. The auto
 * branch exists so site-flag docs can express "no preference, use
 * the safe default" without inventing a magic falsy value.
 */
export function resolveLayoutMode(mode: SiteLayoutMode | undefined | null): 'tabs' | 'scroll' {
    if (mode === 'scroll') return 'scroll';
    if (mode === 'tabs') return 'tabs';
    // `'auto'`, undefined, null, or any unknown value: default to 'tabs'.
    return 'tabs';
}

export interface ISiteFlags {
    blogEnabled: boolean;
    /** How the public site renders navigation: classic tab-per-page or a single
     *  stacked document with smooth-scroll anchors. `'auto'` resolves to
     *  `'tabs'` (the safe default for F1 sub-pages); operators set explicit
     *  `'scroll'` for legacy single-narrative bundles. */
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
    /** Master toggle for guest checkout. When false, anonymous callers
     *  can't drive the checkout-flow mutations — they have to sign in
     *  first. Default true. See docs/features/checkout.md §1. */
    allowGuestCheckout?: boolean;
    /** Site-wide default admin UI mode (per `docs/features/platform/admin-ui-modes.md`).
     *  Per-user `IUser.adminUiMode` overrides this when set. Default 'advanced'. */
    defaultAdminUiMode?: 'simplified' | 'advanced';
    /** Email-provider configuration. When the whole block is absent
     *  the mailer falls back to the legacy `SMTP_*` env-var path so
     *  pre-migration deployments keep working. Secrets are
     *  AES-GCM-wrapped via `secretBox` when SECRETBOX_KEY is set. */
    mail?: ISiteMailConfig;
    version?: number;
    editedBy?: string;
    editedAt?: string;
}

export type SiteMailProvider = 'smtp' | 'resend' | 'disabled';

export interface ISiteMailConfig {
    provider: SiteMailProvider;
    /** RFC-5322 from header, e.g. `Funisimo <noreply@funisimo.pro>` */
    from?: string;
    /** Inquiry recipient. Wins over the top-level
     *  `inquiryRecipientEmail` when set. */
    inquiryRecipient?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassEncrypted?: string;
    resendApiKeyEncrypted?: string;
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
    allowGuestCheckout: true,
    defaultAdminUiMode: 'advanced',
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

/** Sanitise `mail` block: bound provider to the enum, drop unknown
 *  fields, normalise port to a number. Encryption envelope strings are
 *  passed through opaquely — the EmailService decrypts on use. */
function sanitizeMailConfig(raw: unknown): ISiteMailConfig | undefined {
    if (!raw || typeof raw !== 'object') return undefined;
    const r = raw as Partial<ISiteMailConfig> & {smtpPass?: string; resendApiKey?: string};
    const provider: SiteMailProvider = r.provider === 'smtp' || r.provider === 'resend' || r.provider === 'disabled'
        ? r.provider
        : 'disabled';
    const port = typeof r.smtpPort === 'number'
        ? r.smtpPort
        : (typeof r.smtpPort === 'string' ? Number(r.smtpPort) : undefined);
    // Encrypt plaintext on the way in. The admin form (and the
    // `email.config.update` MCP tool) sends `smtpPass` / `resendApiKey`
    // plaintext exactly once — we encrypt and persist as `*Encrypted`.
    // When neither plaintext nor pre-encrypted is supplied, leave the
    // field undefined so `save()` can preserve the prior encrypted blob.
    const smtpPassEncrypted = typeof r.smtpPass === 'string' && r.smtpPass.length > 0
        ? secretBoxEncrypt(r.smtpPass)
        : (typeof r.smtpPassEncrypted === 'string' && r.smtpPassEncrypted.length > 0 ? r.smtpPassEncrypted : undefined);
    const resendApiKeyEncrypted = typeof r.resendApiKey === 'string' && r.resendApiKey.length > 0
        ? secretBoxEncrypt(r.resendApiKey)
        : (typeof r.resendApiKeyEncrypted === 'string' && r.resendApiKeyEncrypted.length > 0 ? r.resendApiKeyEncrypted : undefined);
    return {
        provider,
        from: typeof r.from === 'string' ? r.from.trim() : undefined,
        inquiryRecipient: isPlausibleEmail(r.inquiryRecipient) ? r.inquiryRecipient : undefined,
        smtpHost: typeof r.smtpHost === 'string' ? r.smtpHost.trim() : undefined,
        smtpPort: Number.isFinite(port) && port! > 0 ? Math.floor(port!) : undefined,
        smtpUser: typeof r.smtpUser === 'string' ? r.smtpUser.trim() : undefined,
        smtpPassEncrypted,
        resendApiKeyEncrypted,
    };
}

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
            layoutMode: (value?.layoutMode === 'scroll' || value?.layoutMode === 'tabs' || value?.layoutMode === 'auto')
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
            allowGuestCheckout: typeof value?.allowGuestCheckout === 'boolean'
                ? value.allowGuestCheckout
                : DEFAULT_SITE_FLAGS.allowGuestCheckout,
            defaultAdminUiMode: (value?.defaultAdminUiMode === 'simplified' || value?.defaultAdminUiMode === 'advanced')
                ? value.defaultAdminUiMode
                : DEFAULT_SITE_FLAGS.defaultAdminUiMode,
            mail: sanitizeMailConfig(value?.mail),
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
            layoutMode: (flags.layoutMode === 'scroll' || flags.layoutMode === 'tabs' || flags.layoutMode === 'auto')
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
            allowGuestCheckout: typeof flags.allowGuestCheckout === 'boolean'
                ? flags.allowGuestCheckout
                : current.allowGuestCheckout,
            defaultAdminUiMode: (flags.defaultAdminUiMode === 'simplified' || flags.defaultAdminUiMode === 'advanced')
                ? flags.defaultAdminUiMode
                : current.defaultAdminUiMode,
            mail: flags.mail !== undefined ? sanitizeMailConfig(flags.mail) : current.mail,
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
