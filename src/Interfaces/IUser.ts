export type UserRole = 'viewer' | 'editor' | 'admin';

export type AdminLocale = 'en' | 'lv';

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
}
