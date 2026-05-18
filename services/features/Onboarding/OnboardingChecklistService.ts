import {Collection, Db} from 'mongodb';
import {log} from '@services/infra/logger';
import {SiteFlagsService} from '@services/features/Seo/SiteFlagsService';
import {isFeatureEnabled} from '@services/infra/featureFlags';

/**
 * admin-first-time-guide — active first-time guide service.
 *
 * Sits on top of the (already-shipped) `/admin/onboarding` wizard. The
 * wizard handed the operator a seeded site; this service surfaces the
 * "now what?" — required configuration the operator must still complete
 * before going public, plus recommended next steps from the active
 * feature set.
 *
 * Read-only by default; the persisted state is two things:
 *   1. `OnboardingChecklist` overrides (per-id, per-operator dismissals
 *      via `markComplete`). Stored in `OnboardingChecklist` collection.
 *   2. Tour-step completion (`completedTourSteps[]` on the User doc).
 *
 * Item ids are stable string keys (`site.title`, `operator.vatId`,
 * `email.dkim`, `commerce.payment`, etc.) — the UI deep-links + the MCP
 * tools both address items by id.
 *
 * Feature-aware: each `commerceFeatureActive()` / `mailConfigured()` etc.
 * lookup walks the same SiteFlags + featureFlags surfaces the rest of
 * the system reads. New flags get a new branch here, not a per-feature
 * registration — the surface is small enough that a centralised walker
 * is easier to audit than a contribution registry, and "what's still
 * missing for this site to go public" is by nature cross-cutting.
 */

export type ChecklistSeverity = 'required' | 'recommended';

export interface IChecklistItem {
    id: string;
    severity: ChecklistSeverity;
    title: string;
    why: string;
    completed: boolean;
    targetUrl?: string;
    /** Hash-fragment / query param the target page reads to pre-focus a field. */
    targetFocus?: string;
}

export interface IOnboardingChecklist {
    items: IChecklistItem[];
    completedCount: number;
    totalCount: number;
    requiredPctComplete: number;
}

interface OnboardingOverrideRow {
    id: string;
    completed: boolean;
    completedAt: string;
    completedBy?: string;
}

export class OnboardingChecklistService {
    private overrides: Collection;
    private settings: Collection;
    private languages: Collection;
    private users: Collection;
    private siteFlags: SiteFlagsService;

    constructor(db: Db) {
        this.overrides = db.collection('OnboardingChecklist');
        this.settings = db.collection('SiteSettings');
        this.languages = db.collection('Languages');
        this.users = db.collection('Users');
        this.siteFlags = new SiteFlagsService(db);
        this.overrides.createIndex({id: 1}, {unique: true}).catch(() => {/* exists */});
    }

    /** Compute the full checklist. Required items come first, sorted by id. */
    async list(): Promise<IOnboardingChecklist> {
        const items: IChecklistItem[] = [];
        // Walk the platform's current state. Each helper returns either a
        // fully-formed item or `null` when the feature isn't active.
        items.push(await this.siteTitleItem());
        items.push(await this.defaultLanguageItem());
        items.push(await this.contactEmailItem());
        items.push(this.operatorNameItem());
        items.push(this.operatorVatIdItem());
        items.push(this.operatorAddressItem());

        if (this.commerceActive()) {
            items.push(await this.commercePaymentItem());
        }
        if (this.mailFeatureActive()) {
            items.push(await this.mailDkimItem());
        }
        items.push(this.backupItem());

        // Recommended items — surface follow-on tour-step prompts.
        items.push(this.recommendedThemeItem());
        items.push(this.recommendedInviteUserItem());
        items.push(this.recommendedRunTourItem());

        // Apply persisted overrides (operator clicked "mark done").
        const overrides = await this.loadOverrides();
        for (const it of items) {
            const o = overrides.get(it.id);
            if (o?.completed) it.completed = true;
        }

        // Stable sort: required first, then by id alphabetically inside group.
        items.sort((a, b) => {
            if (a.severity !== b.severity) return a.severity === 'required' ? -1 : 1;
            return a.id.localeCompare(b.id);
        });

        const requiredItems = items.filter(i => i.severity === 'required');
        const requiredDone = requiredItems.filter(i => i.completed).length;
        const completedCount = items.filter(i => i.completed).length;
        return {
            items,
            completedCount,
            totalCount: items.length,
            requiredPctComplete: requiredItems.length > 0
                ? Math.round((requiredDone / requiredItems.length) * 100)
                : 100,
        };
    }

    /** Operator-side dismissal — used by the "mark done" button + MCP. */
    async markComplete(id: string, completed: boolean, by?: string): Promise<IChecklistItem | null> {
        const row: OnboardingOverrideRow = {
            id,
            completed,
            completedAt: new Date().toISOString(),
            completedBy: by,
        };
        await this.overrides.updateOne({id}, {$set: row}, {upsert: true});
        const list = await this.list();
        return list.items.find(i => i.id === id) ?? null;
    }

    /** Tour-step completion is stored per-user — `User.completedTourSteps[]`. */
    async listCompletedTourSteps(userId: string): Promise<string[]> {
        try {
            const u = await this.users.findOne({id: userId}, {projection: {completedTourSteps: 1}});
            const ids = (u as any)?.completedTourSteps;
            return Array.isArray(ids) ? ids.filter((x: unknown): x is string => typeof x === 'string') : [];
        } catch (err) {
            log.error({scope: 'onboarding.tour.list', err, userId}, 'list completed tour steps failed');
            return [];
        }
    }

    async markTourStepComplete(userId: string, stepId: string): Promise<string[]> {
        try {
            await this.users.updateOne({id: userId}, {$addToSet: {completedTourSteps: stepId}});
        } catch (err) {
            log.error({scope: 'onboarding.tour.mark', err, userId, stepId}, 'mark tour step failed');
        }
        return this.listCompletedTourSteps(userId);
    }

    async resetTour(userId: string): Promise<void> {
        try {
            await this.users.updateOne({id: userId}, {$set: {completedTourSteps: []}});
        } catch (err) {
            log.error({scope: 'onboarding.tour.reset', err, userId}, 'reset tour failed');
        }
    }

    // ────────────────────────────────────────────────────────────────────
    // item builders — each returns one IChecklistItem
    // ────────────────────────────────────────────────────────────────────

    private async siteTitleItem(): Promise<IChecklistItem> {
        const doc = await this.settings.findOne({key: 'siteFlags'});
        const value = (doc as any)?.value ?? {};
        const siteName = typeof value.siteName === 'string' ? value.siteName.trim() : '';
        return {
            id: 'site.title',
            severity: 'required',
            title: 'Set your site title',
            why: 'The site title shows in the browser tab, on search results, and in every email your site sends. Pick a name people will recognise.',
            completed: siteName.length > 0,
            targetUrl: '/admin/settings/chrome',
            targetFocus: 'siteName',
        };
    }

    private async defaultLanguageItem(): Promise<IChecklistItem> {
        const count = await this.languages.countDocuments({default: true});
        return {
            id: 'site.defaultLanguage',
            severity: 'required',
            title: 'Pick the default language',
            why: 'Visitors see this language first, and every page falls back to it when a translation is missing.',
            completed: count > 0,
            targetUrl: '/admin/settings/languages',
        };
    }

    private async contactEmailItem(): Promise<IChecklistItem> {
        const flags = await this.siteFlags.get();
        const email = flags.inquiryRecipientEmail ?? '';
        // The default seed value `gatiss.priede@inbox.lv` counts as "still
        // unset" so a fresh install isn't marked done out of the gate.
        const completed = email.length > 0 && !email.endsWith('inbox.lv');
        return {
            id: 'site.contactEmail',
            severity: 'required',
            title: 'Set the contact email',
            why: 'Inquiries and contact-form messages from visitors land in this inbox. Without it you will never see what people send you.',
            completed,
            targetUrl: '/admin/settings/chrome',
            targetFocus: 'inquiryRecipientEmail',
        };
    }

    private operatorNameItem(): IChecklistItem {
        const name = (process.env.SITE_OPERATOR_NAME || process.env.SITE_NAME || '').trim();
        return {
            id: 'operator.name',
            severity: 'required',
            title: 'Set your legal business name',
            why: 'Invoices, receipts, and the privacy policy all reference your legal entity. Customers need to know who they are buying from.',
            completed: name.length > 0,
            targetUrl: '/admin/settings/account',
            targetFocus: 'operatorName',
        };
    }

    private operatorVatIdItem(): IChecklistItem {
        const vat = (process.env.SITE_OPERATOR_VAT_ID || '').trim();
        return {
            id: 'operator.vatId',
            severity: 'recommended',
            title: 'Add your VAT or tax ID',
            why: 'Required for EU B2B sales and surfaced on every invoice. Leave blank if you do not sell to businesses.',
            completed: vat.length > 0,
            targetUrl: '/admin/settings/account',
            targetFocus: 'operatorVatId',
        };
    }

    private operatorAddressItem(): IChecklistItem {
        const line1 = (process.env.SITE_OPERATOR_ADDR_LINE1 || '').trim();
        const city = (process.env.SITE_OPERATOR_ADDR_CITY || '').trim();
        const postcode = (process.env.SITE_OPERATOR_ADDR_POSTCODE || '').trim();
        return {
            id: 'operator.address',
            severity: 'required',
            title: 'Set your business address',
            why: 'Goes on every invoice and is a legal requirement for selling online in most countries.',
            completed: line1.length > 0 && city.length > 0 && postcode.length > 0,
            targetUrl: '/admin/settings/account',
            targetFocus: 'operatorAddress',
        };
    }

    private async commercePaymentItem(): Promise<IChecklistItem> {
        // Stripe is the only wired provider today. Without the secret the
        // checkout falls back to manual-pay / "ask for invoice".
        const hasStripe = (process.env.STRIPE_SECRET_KEY || '').trim().length > 0;
        return {
            id: 'commerce.payment',
            severity: 'required',
            title: 'Connect a payment provider',
            why: 'Without a payment provider, your checkout cannot charge cards. We support Stripe out of the box.',
            completed: hasStripe,
            targetUrl: '/admin/settings/features/commerce',
            targetFocus: 'payment',
        };
    }

    private async mailDkimItem(): Promise<IChecklistItem> {
        const flags = await this.siteFlags.get();
        const provider = flags.mail?.provider ?? 'disabled';
        const hasFrom = (flags.mail?.from ?? '').trim().length > 0;
        // "DKIM configured" is approximated by "the operator has picked a
        // provider, supplied a `from` address, and a credential is on file".
        // The real DNS-record verification is a separate operator op.
        const hasCred = provider === 'resend'
            ? (flags.mail?.resendApiKeyEncrypted ?? '').length > 0
            : provider === 'smtp'
                ? (flags.mail?.smtpPassEncrypted ?? '').length > 0
                : false;
        return {
            id: 'email.dkim',
            severity: 'required',
            title: 'Configure outbound email',
            why: 'Order receipts, password resets, and inquiry replies all need a working mail provider. Without DKIM, your emails land in spam.',
            completed: provider !== 'disabled' && hasFrom && hasCred,
            targetUrl: '/admin/settings/features/email',
            targetFocus: 'mail',
        };
    }

    private backupItem(): IChecklistItem {
        const hasBackup = (process.env.RESTIC_REPOSITORY || process.env.BACKUP_DESTINATION || '').trim().length > 0;
        return {
            id: 'backup.destination',
            severity: 'required',
            title: 'Set up backups',
            why: 'A backup destination keeps your site recoverable if anything goes wrong with the database.',
            completed: hasBackup,
            targetUrl: '/admin/system/backups',
        };
    }

    private recommendedThemeItem(): IChecklistItem {
        return {
            id: 'theme.picked',
            severity: 'recommended',
            title: 'Pick a theme',
            why: 'Themes change the look and feel of your public site without touching any code.',
            completed: false,
            targetUrl: '/admin/settings/theme',
        };
    }

    private recommendedInviteUserItem(): IChecklistItem {
        return {
            id: 'people.invite',
            severity: 'recommended',
            title: 'Invite another admin',
            why: 'Two admins are safer than one. If you lock yourself out, the other admin can let you back in.',
            completed: false,
            targetUrl: '/admin/settings/access/users',
        };
    }

    private recommendedRunTourItem(): IChecklistItem {
        return {
            id: 'tour.completed',
            severity: 'recommended',
            title: 'Take the guided tour',
            why: 'A 30-second tour points out where each feature lives so you do not have to hunt.',
            completed: false,
            targetUrl: '/admin/build?tour=start',
        };
    }

    private commerceActive(): boolean {
        return isFeatureEnabled('products') || isFeatureEnabled('cart') || isFeatureEnabled('orders');
    }

    private mailFeatureActive(): boolean {
        // Mail is always active in principle, but only relevant when the
        // operator has at least started picking a provider. Treat the item
        // as in-scope whenever a provider has been chosen explicitly or
        // when the legacy SMTP env vars are present.
        return Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
    }

    private async loadOverrides(): Promise<Map<string, OnboardingOverrideRow>> {
        try {
            const rows = await this.overrides.find({}, {projection: {_id: 0}}).toArray();
            const map = new Map<string, OnboardingOverrideRow>();
            for (const r of rows) map.set((r as any).id, r as unknown as OnboardingOverrideRow);
            return map;
        } catch (err) {
            log.error({scope: 'onboarding.overrides.load', err}, 'load failed');
            return new Map();
        }
    }
}
