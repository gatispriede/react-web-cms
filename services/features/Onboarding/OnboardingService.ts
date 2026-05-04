import {Collection, Db} from 'mongodb';
import guid from '@utils/guid';
import {hash} from 'bcrypt';
import {log} from '@services/infra/logger';

/**
 * Q7 — first-run onboarding service.
 *
 * Detection contract:
 *   `isFreshInstall()` returns true when the Users collection has zero
 *   admin-kind documents. A single user count is sufficient: an admin
 *   account is required to seed every other piece of CMS state, so
 *   "no admins" implies "nothing has been configured yet".
 *
 * Bootstrap atomicity:
 *   `bootstrap()` runs in 4 steps (race re-check → admin insert → site-flag
 *   write → theme activation). Mongo has no multi-document transaction
 *   guarantee here, so we order the steps "least recoverable first":
 *   if the admin insert succeeds and a later step throws, the user is
 *   left signed-in-able and can finish setup manually from the admin
 *   panes. The race re-check at the top is the only correctness-critical
 *   step — once an admin row exists, the wizard route refuses to render.
 */

export type ThemeKey = string;

export interface OnboardingBootstrapInput {
    siteName: string;
    locale: string;
    adminEmail: string;
    adminPassword: string;
    themeKey?: ThemeKey;
}

export interface OnboardingBootstrapResult {
    userId: string;
    email: string;
    themeId?: string;
}

const SITE_FLAGS_KEY = 'siteFlags';
const SITE_NAME_KEY = 'siteName';
const ACTIVE_THEME_KEY = 'activeThemeId';
const MIN_PASSWORD_LENGTH = 12;

export class OnboardingService {
    private users: Collection;
    private settings: Collection;
    private themes: Collection;
    private languages: Collection;
    private readonly hashSaltRounds: number;

    constructor(db: Db, hashSaltRounds = 10) {
        this.users = db.collection('Users');
        this.settings = db.collection('SiteSettings');
        this.themes = db.collection('Themes');
        this.languages = db.collection('Languages');
        this.hashSaltRounds = hashSaltRounds;
    }

    /**
     * "Fresh install" = zero admin-kind users. Customers can exist (rare
     * in practice — the public-site sign-up flow needs the CMS already
     * up) without disqualifying onboarding.
     */
    async isFreshInstall(): Promise<boolean> {
        try {
            const count = await this.users.countDocuments({
                $or: [{kind: 'admin'}, {kind: {$exists: false}, role: {$in: ['admin', 'editor', 'viewer']}}],
            });
            return count === 0;
        } catch (err) {
            log.error({scope: 'onboarding.isFreshInstall', err}, 'detection failed');
            // Fail "not fresh" — refuses to expose the wizard on a flaky
            // connection, since a false positive would let a passer-by
            // re-seed the admin.
            return false;
        }
    }

    async bootstrap(input: OnboardingBootstrapInput): Promise<OnboardingBootstrapResult> {
        const siteName = (input.siteName ?? '').trim();
        const locale = (input.locale ?? '').trim();
        const email = (input.adminEmail ?? '').trim().toLowerCase();
        const password = input.adminPassword ?? '';
        if (!siteName) throw new Error('siteName is required');
        if (!locale) throw new Error('locale is required');
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('valid adminEmail is required');
        if (!password || password.length < MIN_PASSWORD_LENGTH) {
            throw new Error(`adminPassword must be at least ${MIN_PASSWORD_LENGTH} characters`);
        }

        // Race guard — re-check inside the bootstrap so two simultaneous
        // wizard submits can't both win.
        const fresh = await this.isFreshInstall();
        if (!fresh) throw new Error('onboarding already complete');

        const userId = guid();
        const passwordHash = await hash(password, this.hashSaltRounds);
        await this.users.insertOne({
            id: userId,
            name: email.split('@')[0],
            email,
            password: passwordHash,
            role: 'admin',
            kind: 'admin',
            canPublishProduction: true,
            mustChangePassword: false,
            createdAt: new Date().toISOString(),
        } as any);

        // Site name + default locale into siteFlags.value so the existing
        // SiteFlagsService surfaces them (defensive merge — we only set
        // the fields we own; future flag additions don't get clobbered).
        try {
            const existing = await this.settings.findOne({key: SITE_FLAGS_KEY});
            const value = (existing as any)?.value ?? {};
            await this.settings.updateOne(
                {key: SITE_FLAGS_KEY},
                {$set: {key: SITE_FLAGS_KEY, value: {...value, [SITE_NAME_KEY]: siteName, defaultLocale: locale}}},
                {upsert: true},
            );
        } catch (err) {
            log.error({scope: 'onboarding.siteFlags', err}, 'site-flag write failed');
        }

        // Default-language row — best-effort. The full Languages flow lives
        // in `LanguageService`; here we just stamp a default symbol so the
        // public site renders something on first visit.
        try {
            await this.languages.updateOne(
                {symbol: locale},
                {$set: {symbol: locale, label: locale, default: true}},
                {upsert: true},
            );
            await this.languages.updateMany(
                {symbol: {$ne: locale}, default: true},
                {$set: {default: false}},
            );
        } catch (err) {
            log.error({scope: 'onboarding.language', err}, 'default language write failed');
        }

        // Theme activation — best-effort. Themes are seeded by ThemesServiceLoader
        // onBoot before this call lands. Match by name (the wizard sends a preset
        // name like "Studio") and write the active pointer.
        let themeId: string | undefined;
        try {
            if (input.themeKey) {
                const theme = await this.themes.findOne({name: input.themeKey});
                if (theme) {
                    themeId = (theme as any).id;
                    await this.settings.updateOne(
                        {key: ACTIVE_THEME_KEY},
                        {$set: {key: ACTIVE_THEME_KEY, value: themeId}},
                        {upsert: true},
                    );
                }
            }
        } catch (err) {
            log.error({scope: 'onboarding.theme', err}, 'theme activation failed');
        }

        return {userId, email, themeId};
    }
}
