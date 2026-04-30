export type UserRole = 'viewer' | 'editor' | 'admin';

export type AdminLocale = 'en' | 'lv';

export type UserKind = 'admin' | 'customer';

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
    kind?: UserKind;
    googleSub?: string;
    emailVerified?: string;
    phone?: string;
    shippingAddresses?: IAddress[];
    createdAt?: string;
}
