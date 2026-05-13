export type UserRole = 'viewer' | 'editor' | 'admin';

export type AdminLocale = 'en' | 'lv';

export type UserKind = 'admin' | 'customer';

/**
 * Admin UI mode — `simplified` shows the cut-down per-feature view,
 * `advanced` shows the full surface. Per `docs/features/platform/admin-ui-modes.md`
 * (decisions 2026-05-02). Stored on `IUser.adminUiMode`; `null` /
 * undefined falls through to `siteFlags.defaultAdminUiMode`, then to
 * `'advanced'` if neither is set. Mode is a UI affordance, NOT a role —
 * see decision 1.
 */
export type AdminUiMode = 'simplified' | 'advanced';

export interface IAddress {
    id: string;
    name: string;
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
    isDefault?: boolean;
}

export interface InAddress {
    id?: string;
    name: string;
    line1: string;
    line2?: string;
    city: string;
    postalCode: string;
    country: string;
    isDefault?: boolean;
}

export interface IUser {
    id: string;
    name: string;
    email: string;
    password: string;
    role?: UserRole;
    avatar?: string;
    canPublishProduction?: boolean;
    /**
     * Set when the user was seeded with a generated initial password and
     * hasn't rotated it yet. Cleared on the next `updateUser` that sets a
     * fresh password. Drives the persistent "change your password" banner
     * in UserStatusBar.
     */
    mustChangePassword?: boolean;
    /**
     * Admin chrome locale — independent of the public-site dropdown. Lets
     * a translator flip the public site to `lv` for editing without the
     * surrounding admin nav / dialogs also flipping. Client falls back to
     * `localStorage.admin.locale` → browser → `en` when unset.
     */
    preferredAdminLocale?: AdminLocale;
    /**
     * Per-user admin UI mode. Null/undefined → fall through to the
     * site-wide default. Per `docs/features/platform/admin-ui-modes.md`
     * (decision 2026-05-02). Only meaningful for `kind: 'admin'` users.
     */
    adminUiMode?: AdminUiMode;

    /**
     * Discriminator across admin and customer populations. Undefined is
     * implicitly 'admin' for back-compat with legacy docs seeded before
     * the customer flow shipped — `setupAdmin()` back-fills the field
     * the same way it back-fills `role`.
     */
    kind?: UserKind;
    /** Customer-only — Google OAuth `sub` (provider account id). Lets a
     *  customer who originally signed up with email+password later link
     *  Google by matching email. */
    googleSub?: string;
    /** ISO date — set when Google attests the email or after a reset
     *  confirmation flow lands. Currently informational. */
    emailVerified?: string;
    /** Customer-only contact field — admins use email only. */
    phone?: string;
    /** Customer-only — list of saved shipping addresses. Mutated via
     *  saveMyAddress / deleteMyAddress, scoped to the current customer. */
    shippingAddresses?: IAddress[];
    /** ISO date — populated on customer creation. Admin docs may not
     *  carry this for legacy reasons. */
    createdAt?: string;
    /**
     * Q10 — three-dimension grants (feature / page / locale). A mutation
     * gated on multiple dimensions requires the user to hold a matching
     * grant for EACH dimension (intersection). Admin rank bypasses.
     * See `shared/types/IPermission.ts` + `docs/features/platform/edit-levels.md`.
     */
    grants?: import('./IPermission').Grant[];
    /**
     * W8f — per-customer notification preferences. Per-category routing
     * (email / inbox / both / off) + optional quiet hours + digest
     * cadence. See `shared/types/INotificationPreferences.ts`.
     * Missing → defaults from `DEFAULT_NOTIFICATION_PREFERENCES`.
     */
    notificationPreferences?: import('./INotificationPreferences').INotificationPreferences;
    /**
     * W6c — marketing attribution. `firstTouchUtm` is immutable after
     * first set (the original ad / referrer the customer came in on);
     * `lastTouchUtm` is overwritten on every subsequent attributable
     * visit so the order-level "what brought them back for this order"
     * view stays current. Both populated by
     * `MarketingAttributionService.attachToUser`.
     */
    firstTouchUtm?: IUserUtm;
    lastTouchUtm?: IUserUtm;
    /**
     * client-account-settings-page (Phase 1.E) — customer-account
     * discriminator. `'client'` = individual / B2C, `'company'` = B2B
     * with company sub-record + VAT id. Implicit `'client'` for
     * legacy customer rows (back-compat — no migration required).
     * Only meaningful when `kind === 'customer'`.
     */
    customerType?: 'client' | 'company';
    /**
     * Company sub-record — required when `customerType === 'company'`.
     * Single-user-per-company today; multi-user roster is a future
     * `ICompanyAccount` expansion path (decision tracked in spec).
     */
    company?: import('./ICompanyProfile').ICompanyProfile;
    /**
     * Saved payment methods (Stripe-tokenized refs — see
     * `IPaymentMethodRef`). Empty for guest checkouts and for shoppers
     * who only ever use one-off cards.
     */
    paymentMethods?: import('./IPaymentMethodRef').IPaymentMethodRef[];
    /**
     * Optional date-of-birth (ISO date, `YYYY-MM-DD`) — collected only
     * from `'client'`-type customers for marketing segmentation (W6c).
     * Omitted for `'company'` customers.
     */
    dateOfBirth?: string;
    /** Preferred site language (ISO code, e.g. `'en'`, `'lv'`) — drives
     *  the storefront locale picker for signed-in customers and the
     *  default `lang` for outbound emails. */
    preferredLanguage?: string;
    /** Preferred currency (ISO 4217, e.g. `'EUR'`) — W8g cart default. */
    preferredCurrency?: string;
}

export interface IUserUtm {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
    referrer?: string;
    landingPath?: string;
    capturedAt: string;
}

export interface InUser {
    id?: string;
    name?: string;
    email: string;
    password?: string;
    role?: UserRole;
    avatar?: string;
    canPublishProduction?: boolean;
    mustChangePassword?: boolean;
    preferredAdminLocale?: AdminLocale;
    adminUiMode?: AdminUiMode;
    kind?: UserKind;
    googleSub?: string;
    emailVerified?: string;
    phone?: string;
    shippingAddresses?: IAddress[];
    createdAt?: string;
    grants?: import('./IPermission').Grant[];
    notificationPreferences?: import('./INotificationPreferences').INotificationPreferences;
    customerType?: 'client' | 'company';
    company?: import('./ICompanyProfile').ICompanyProfile;
    paymentMethods?: import('./IPaymentMethodRef').IPaymentMethodRef[];
    dateOfBirth?: string;
    preferredLanguage?: string;
    preferredCurrency?: string;
}
