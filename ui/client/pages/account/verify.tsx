import React, {useState} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import {signIn, getSession} from 'next-auth/react';
import {Alert, Button, Spin} from 'antd';
import {attachMarketingSessionToUser} from '@client/lib/marketingCapture';

/**
 * W6c — magic-link verify (click-to-confirm) page.
 *
 * Defeats cross-device pre-fetch: email clients on mobile (Outlook,
 * Apple Mail) frequently fetch every link in the inbox preview pipeline
 * with a HEAD/GET — that would burn a single-use token before the human
 * ever clicks. We render a confirmation button on GET and only redeem
 * the token on an explicit POST (the user-initiated click).
 *
 * The token is taken from the query string but never auto-consumed.
 * The user must click "Sign in to continue" before NextAuth's
 * `signIn('customer-magic')` posts the token to the credential
 * provider, which calls `CustomerAuthService.redeemMagicLinkToken`.
 */
const VerifyPage = ({token, callbackUrl}: {token: string | null; callbackUrl: string}) => {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onConfirm = async () => {
        if (!token) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await signIn('customer-magic', {
                redirect: false,
                token,
                callbackUrl,
            });
            if (res?.ok) {
                // W6c gap-close — anonymous → identified merge on the
                // magic-link path. The credential provider doesn't hand
                // the userId back to `signIn`, so we read it off the
                // freshly-minted session and forward the `attr_session_id`
                // cookie to `attachMarketingSession`. This makes
                // firstTouchUtm/lastTouchUtm flow into the user record
                // for magic-link sign-ups, matching the password-signup
                // path (authWrappers.tsx). Best-effort: a telemetry miss
                // never blocks the redirect.
                try {
                    const session = await getSession();
                    const userId = (session?.user as {id?: string} | undefined)?.id;
                    if (userId) await attachMarketingSessionToUser(userId);
                } catch { /* ignore — attribution is best-effort */ }
            }
            if (res?.ok && res.url) {
                window.location.href = res.url;
            } else if (res?.ok) {
                window.location.href = callbackUrl || '/account';
            } else {
                setError('This link has expired or already been used. Request a new one.');
            }
        } catch (e: any) {
            setError(e?.message || 'Could not complete sign-in');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f5f5f5'}}>
            <div style={{width: '100%', maxWidth: 420, background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                <h2 style={{marginTop: 0, marginBottom: 16}}>Confirm sign-in</h2>
                {!token ? (
                    <Alert
                        type="error"
                        showIcon
                        data-testid="customer-verify-no-token"
                        message="Missing token"
                        description={(
                            <span>
                                Open the link from your email to continue, or{' '}
                                <Link href="/account/magic-link">request a new one</Link>.
                            </span>
                        )}
                    />
                ) : (
                    <>
                        {error ? <Alert type="error" showIcon style={{marginBottom: 12}} message={error} data-testid="customer-verify-error"/> : null}
                        <p style={{marginBottom: 16}}>
                            Click the button below to finish signing in. This link can only be used once.
                        </p>
                        <Button
                            type="primary"
                            block
                            onClick={onConfirm}
                            loading={submitting}
                            data-testid="customer-verify-confirm-btn"
                        >
                            {submitting ? <Spin size="small"/> : 'Sign in to continue'}
                        </Button>
                        {error ? (
                            <div style={{marginTop: 16, textAlign: 'center'}}>
                                <Link href={`/account/magic-link?callbackUrl=${encodeURIComponent(callbackUrl)}`} data-testid="customer-verify-resend-link">
                                    Send a new link
                                </Link>
                            </div>
                        ) : null}
                    </>
                )}
            </div>
        </div>
    );
};

export const getServerSideProps: GetServerSideProps = async ({query}) => {
    const token = typeof query.token === 'string' ? query.token : null;
    const cb = typeof query.callbackUrl === 'string' ? query.callbackUrl : '/account';
    return {props: {token, callbackUrl: cb}};
};

export default VerifyPage;
