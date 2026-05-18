import React, {useState} from 'react';
import Link from 'next/link';
import {useSession, signOut} from 'next-auth/react';
import {useAuthFlags} from './useAuthFlags';

/**
 * Header account control — auth-split-client-admin (Phase 1.A).
 *
 * Renders nothing when `siteFlags.auth.clientLoginEnabled === false`
 * so the no-auth storefront has zero login surface in the header.
 *
 * Two states when enabled:
 *  - Unauthed → single "Sign in" link to `/account/signin` with the
 *    current path threaded through as `returnTo`.
 *  - Authed → user's display name (or email-local fallback) +
 *    fly-out menu (My orders / My account / Notifications / Privacy /
 *    Sign out).
 *
 * Every interactive carries a `data-testid` for the e2e specs in
 * `tests/e2e/auth/`.
 */
export const CustomerAccountDropdown: React.FC = () => {
    const flags = useAuthFlags();
    const {data: session, status} = useSession();
    const [open, setOpen] = useState(false);

    if (!flags.clientLoginEnabled) return null;

    if (status !== 'authenticated' || (session?.user as any)?.kind !== 'customer') {
        const here = typeof window !== 'undefined' ? window.location.pathname : '/';
        const href = `/account/signin?returnTo=${encodeURIComponent(here)}`;
        return (
            <Link href={href} data-testid="customer-account-signin-link" className="customer-account-signin">
                Sign in
            </Link>
        );
    }

    const u = session.user as {name?: string; email?: string};
    const display = (u.name && u.name.trim()) || (u.email?.split('@')[0] ?? 'Account');

    return (
        <div className="customer-account-dropdown" data-testid="customer-account-dropdown">
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(v => !v)}
                data-testid="customer-account-dropdown-trigger"
            >
                Hi, {display}
            </button>
            {open ? (
                <ul role="menu" className="customer-account-dropdown__menu">
                    <li role="none"><Link role="menuitem" href="/account/orders" data-testid="customer-account-menu-orders">My orders</Link></li>
                    <li role="none"><Link role="menuitem" href="/account" data-testid="customer-account-menu-account">My account</Link></li>
                    <li role="none"><Link role="menuitem" href="/account/notifications" data-testid="customer-account-menu-notifications">Notifications</Link></li>
                    <li role="none"><Link role="menuitem" href="/account/privacy" data-testid="customer-account-menu-privacy">Privacy</Link></li>
                    <li role="none">
                        <button
                            role="menuitem"
                            type="button"
                            onClick={() => signOut({callbackUrl: '/'})}
                            data-testid="customer-account-menu-signout"
                        >
                            Sign out
                        </button>
                    </li>
                </ul>
            ) : null}
        </div>
    );
};

export default CustomerAccountDropdown;
