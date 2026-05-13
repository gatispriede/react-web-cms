import React from 'react';
import Link from 'next/link';
import {useSession} from 'next-auth/react';
import {useAuthFlags} from './useAuthFlags';

/**
 * "Have an account? Sign in" CTA — embedded above the guest-checkout
 * form. Renders null when the master flag is off OR when the visitor
 * is already authed as a customer (no point pestering a signed-in
 * shopper to sign in).
 */
export const LoginCta: React.FC<{returnTo?: string}> = ({returnTo}) => {
    const flags = useAuthFlags();
    const {data: session} = useSession();
    if (!flags.clientLoginEnabled) return null;
    if ((session?.user as any)?.kind === 'customer') return null;
    const to = returnTo ?? (typeof window !== 'undefined' ? window.location.pathname : '/checkout');
    return (
        <div className="login-cta" data-testid="login-cta">
            <strong>Have an account?</strong>{' '}
            <Link href={`/account/signin?returnTo=${encodeURIComponent(to)}`} data-testid="login-cta-link">
                Sign in for faster checkout
            </Link>
        </div>
    );
};

export default LoginCta;
