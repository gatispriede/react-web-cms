import React from 'react';
import Link from 'next/link';
import {useAuthFlags} from './useAuthFlags';

/**
 * Footer account-links column — auth-split-client-admin (Phase 1.A).
 * Returns null when `clientLoginEnabled === false` so the no-auth
 * footer carries no account-surface text.
 */
export const AccountLinks: React.FC = () => {
    const flags = useAuthFlags();
    if (!flags.clientLoginEnabled) return null;
    return (
        <ul className="footer-account-links" data-testid="footer-account-links">
            <li><Link href="/account/signin" data-testid="footer-account-signin">Sign in</Link></li>
            <li><Link href="/account/signup" data-testid="footer-account-signup">Create account</Link></li>
            <li><Link href="/account/orders" data-testid="footer-account-orders">My orders</Link></li>
        </ul>
    );
};

export default AccountLinks;
