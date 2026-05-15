import React, {useEffect, useMemo, useRef, useState} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import {signIn} from 'next-auth/react';
import {Alert, Button, ConfigProvider, Divider, Form, Input} from 'antd';
import staticTheme from '@client/features/Themes/themeConfig';
import {GoogleOutlined, FacebookFilled, AppleFilled} from '@ant-design/icons';
import {MagicLinkRequestForm} from '@client/components/Auth/MagicLinkRequestForm';
import {getMongoConnection} from '@services/infra/mongoDBConnection';

/**
 * Customer sign-in page — auth-split-client-admin (Phase 1.A).
 *
 * Magic-link-first UX (W6c recommendation). Credentials + OAuth
 * providers are surfaced behind a "More options" disclosure, each
 * gated by its own per-provider site-flag (`auth.providerCredentials`,
 * `auth.providerGoogle`, …). The Google / Facebook / Apple buttons
 * are additionally env-gated on the providers being configured —
 * having the toggle on without keys present surfaces a quiet
 * "configure provider" hint instead of a broken button.
 *
 * Submits to `/api/auth/callback/<provider>` (customer NextAuth
 * instance). Supports `?returnTo=` for post-login redirect.
 *
 * When `siteFlags.auth.clientLoginEnabled === false` the route is
 * never reachable — middleware rewrites it to /404 before this page
 * renders. The `notFound` guard below is belt-and-braces.
 */

const RETRY_RE = /\s*\[retryMs=(\d+)\]\s*$/;
function parseError(raw: string): {message: string; retryMs: number} {
    const m = raw.match(RETRY_RE);
    if (!m) return {message: raw, retryMs: 0};
    return {message: raw.replace(RETRY_RE, '').trim(), retryMs: Number(m[1]) || 0};
}

function formatRemaining(ms: number): string {
    const s = Math.max(0, Math.ceil(ms / 1000));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
}

interface PageProps {
    returnTo: string;
    providers: {
        magicLink: boolean;
        credentials: boolean;
        google: boolean;
        facebook: boolean;
        apple: boolean;
    };
}

const CustomerSignInPage = ({returnTo, providers}: PageProps) => {
    const [showMore, setShowMore] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [lockedUntil, setLockedUntil] = useState<number>(0);
    const [now, setNow] = useState<number>(() => Date.now());
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (lockedUntil <= now) {
            if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
            return;
        }
        if (tickRef.current) return;
        tickRef.current = setInterval(() => setNow(Date.now()), 1000);
        return () => {
            if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
        };
    }, [lockedUntil, now]);

    const remainingMs = Math.max(0, lockedUntil - now);
    const isLocked = remainingMs > 0;

    const onFinishCredentials = async (values: {email: string; password: string}) => {
        if (isLocked) return;
        setSubmitting(true);
        setErrorText(null);
        try {
            const res = await signIn('customer-credentials', {
                redirect: false,
                email: values.email,
                password: values.password,
                callbackUrl: returnTo,
            });
            if (res?.error) {
                const {message, retryMs} = parseError(res.error);
                setErrorText(message || 'Sign in failed');
                if (retryMs > 0) {
                    setLockedUntil(Date.now() + retryMs);
                    setNow(Date.now());
                }
            } else if (res?.ok) {
                window.location.href = res.url || returnTo;
            }
        } catch (e: any) {
            setErrorText(e?.message || 'Sign in failed');
        } finally {
            setSubmitting(false);
        }
    };

    const lockedBanner = useMemo(() => {
        if (!isLocked) return null;
        return (
            <Alert
                type="warning"
                showIcon
                style={{marginBottom: 16}}
                message="Account temporarily locked"
                description={`Try again in ${formatRemaining(remainingMs)}`}
            />
        );
    }, [isLocked, remainingMs]);

    const oauthRow = (
        <div style={{display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12}}>
            {providers.google && (
                <Button icon={<GoogleOutlined/>} onClick={() => signIn('customer-google', {callbackUrl: returnTo})} data-testid="customer-signin-google-btn">Google</Button>
            )}
            {providers.facebook && (
                <Button icon={<FacebookFilled/>} onClick={() => signIn('customer-facebook', {callbackUrl: returnTo})} data-testid="customer-signin-facebook-btn">Facebook</Button>
            )}
            {providers.apple && (
                <Button icon={<AppleFilled/>} onClick={() => signIn('customer-apple', {callbackUrl: returnTo})} data-testid="customer-signin-apple-btn">Apple</Button>
            )}
        </div>
    );

    return (
        <ConfigProvider theme={staticTheme}>
        <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f5f5f5'}}>
            <div style={{width: '100%', maxWidth: 420, background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                <h2 style={{marginTop: 0, marginBottom: 16}}>Sign in</h2>
                {errorText ? <Alert type="error" showIcon style={{marginBottom: 12}} message={errorText}/> : null}
                {lockedBanner}

                {providers.magicLink && (
                    <div data-testid="customer-signin-magic-section">
                        <p style={{marginTop: 0, color: '#555'}}>We&rsquo;ll email you a one-tap sign-in link — no password needed.</p>
                        <MagicLinkRequestForm returnTo={returnTo} autoFocus/>
                    </div>
                )}

                {(providers.credentials || providers.google || providers.facebook || providers.apple) && (
                    <>
                        <Divider plain style={{marginTop: 24}}>
                            <button
                                type="button"
                                onClick={() => setShowMore(v => !v)}
                                data-testid="customer-signin-more-options"
                                style={{background: 'none', border: 'none', cursor: 'pointer', color: '#1677ff'}}
                            >
                                {showMore ? 'Fewer options' : 'More options'}
                            </button>
                        </Divider>
                        {showMore && (
                            <>
                                {providers.credentials && (
                                    <Form layout="vertical" onFinish={onFinishCredentials} disabled={isLocked || submitting} data-testid="customer-signin-credentials-form">
                                        <Form.Item label="Email" name="email" rules={[{required: true, type: 'email'}]}>
                                            <Input autoComplete="email" data-testid="customer-signin-email-input"/>
                                        </Form.Item>
                                        <Form.Item label="Password" name="password" rules={[{required: true}]}>
                                            <Input.Password autoComplete="current-password" data-testid="customer-signin-password-input"/>
                                        </Form.Item>
                                        <Button type="primary" htmlType="submit" block loading={submitting} disabled={isLocked} data-testid="customer-signin-submit-btn">
                                            {isLocked ? `Try again in ${formatRemaining(remainingMs)}` : 'Sign in with password'}
                                        </Button>
                                    </Form>
                                )}
                                {(providers.google || providers.facebook || providers.apple) && oauthRow}
                            </>
                        )}
                    </>
                )}

                <div style={{marginTop: 16, textAlign: 'center'}}>
                    <Link href={`/account/signup?callbackUrl=${encodeURIComponent(returnTo)}`}>Create an account</Link>
                </div>
            </div>
        </div>
        </ConfigProvider>
    );
};

export const getServerSideProps: GetServerSideProps<PageProps> = async ({query}) => {
    const cb = typeof query.returnTo === 'string' && query.returnTo.startsWith('/')
        ? query.returnTo
        : (typeof query.callbackUrl === 'string' && query.callbackUrl.startsWith('/') ? query.callbackUrl : '/account');
    // Belt-and-braces: middleware should already have 404'd this, but
    // if it didn't (test env, edge bypass), still 404 here so the page
    // never renders without the flag on.
    let flags: any = {};
    try {
        flags = (await getMongoConnection().siteFlagsService.get()).auth ?? {};
    } catch { /* fall through to defaults */ }
    if (flags.clientLoginEnabled === false) {
        return {notFound: true};
    }
    return {
        props: {
            returnTo: cb,
            providers: {
                magicLink: Boolean(flags.providerMagicLink ?? true),
                credentials: Boolean(flags.providerCredentials) && Boolean(true),
                google: Boolean(flags.providerGoogle) && Boolean(process.env.AUTH_CUSTOMER_GOOGLE_ID && process.env.AUTH_CUSTOMER_GOOGLE_SECRET),
                facebook: Boolean(flags.providerFacebook) && Boolean(process.env.AUTH_FACEBOOK_ID && process.env.AUTH_FACEBOOK_SECRET),
                apple: Boolean(flags.providerApple) && Boolean(process.env.AUTH_APPLE_ID && process.env.AUTH_APPLE_SECRET),
            },
        },
    };
};

export default CustomerSignInPage;
