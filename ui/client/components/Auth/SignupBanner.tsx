import React, {useEffect, useState} from 'react';
import Link from 'next/link';
import {useSession} from 'next-auth/react';
import {useAuthFlags} from './useAuthFlags';

/**
 * Top-of-page promotional banner. Operator-dismissable; dismissal is
 * persisted to the `cms.signupBannerDismissed` cookie so the banner
 * stays gone for ~90 days. Renders null when the master flag is off,
 * when the visitor is already a signed-in customer, or when the
 * dismissal cookie is set.
 */
const DISMISS_COOKIE = 'cms.signupBannerDismissed';
const DISMISS_DAYS = 90;

function isDismissed(): boolean {
    if (typeof document === 'undefined') return false;
    return document.cookie.split('; ').some(c => c.startsWith(`${DISMISS_COOKIE}=1`));
}

function dismiss(): void {
    if (typeof document === 'undefined') return;
    const exp = new Date(Date.now() + DISMISS_DAYS * 24 * 3600 * 1000).toUTCString();
    document.cookie = `${DISMISS_COOKIE}=1; expires=${exp}; path=/; SameSite=Lax`;
}

export const SignupBanner: React.FC = () => {
    const flags = useAuthFlags();
    const {data: session} = useSession();
    const [hidden, setHidden] = useState(true);

    useEffect(() => {
        setHidden(isDismissed());
    }, []);

    if (!flags.clientLoginEnabled) return null;
    if ((session?.user as any)?.kind === 'customer') return null;
    if (hidden) return null;

    return (
        <div className="signup-banner" role="region" aria-label="Account signup" data-testid="signup-banner">
            <span>Track your orders, save addresses, and get exclusive offers.</span>
            <Link href="/account/signup" className="signup-banner__cta" data-testid="signup-banner-cta">
                Create account
            </Link>
            <Link href="/account/signin" data-testid="signup-banner-signin">Sign in</Link>
            <button
                type="button"
                onClick={() => {dismiss(); setHidden(true);}}
                aria-label="Dismiss"
                data-testid="signup-banner-dismiss"
            >
                ×
            </button>
        </div>
    );
};

export default SignupBanner;
