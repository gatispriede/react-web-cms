export type UserRole = 'viewer' | 'editor' | 'admin';

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
}
