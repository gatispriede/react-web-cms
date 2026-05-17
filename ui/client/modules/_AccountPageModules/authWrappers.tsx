/**
 * all-pages-module-composed — Auth batch smart wrappers.
 *
 * Bridge the pure presentational auth modules (`SigninForm`,
 * `SignupForm`, `MagicLinkRequestForm`) to the `{item}` SystemPageDispatch
 * contract. Each host:
 *   - parses operator copy from `item.content`,
 *   - reads provider config from `/api/site/auth-flags` (the same
 *     public, cache-30s endpoint the edge middleware uses),
 *   - wires `onSubmit` / `onOauthChoose` to NextAuth + the customer
 *     GraphQL surface,
 *   - reads `?returnTo=` / `?callbackUrl=` via `useSearchParams()`.
 *
 * The hard 404 on `auth.clientLoginEnabled === false` stays server-side
 * in the page `getServerSideProps`.
 */
import React, {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {Alert, Button, Spin} from 'antd';
import {signIn, getSession} from 'next-auth/react';
import type {IItem} from '@interfaces/IItem';
import {gql, parseEnvelope} from '@client/lib/account/gqlClient';
import {attachMarketingSessionToUser} from '@client/lib/marketingCapture';
import {mcpCall} from '@client/components/AccountSettings/mcpClient';
import SigninForm from '@client/modules/SigninForm/SigninForm';
import type {SigninFormProps, SigninFormResult, SigninFormSubmission} from '@client/modules/SigninForm/SigninForm.types';
import SignupForm from '@client/modules/SignupForm/SignupForm';
import type {SignupFormProps, SignupFormResult, SignupFormSubmission} from '@client/modules/SignupForm/SignupForm.types';
import MagicLinkRequestForm from '@client/modules/MagicLinkRequestForm/MagicLinkRequestForm';
import type {MagicLinkRequestFormProps} from '@client/modules/MagicLinkRequestForm/MagicLinkRequestForm.types';
import type {OauthProvider} from '@client/modules/OauthButtonStack/OauthButtonStack.types';

function parse<T>(raw: string | undefined): T {
    if (!raw) return {} as T;
    try { return JSON.parse(raw) as T; } catch { return {} as T; }
}

const wrapStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: 420,
    margin: '0 auto',
};

interface AuthFlags {
    providerMagicLink: boolean;
    providerCredentials: boolean;
    providerGoogle: boolean;
    providerFacebook: boolean;
    providerApple: boolean;
}

/** Read the public auth-flag namespace; fail closed to magic-link-only. */
function useAuthFlags(): AuthFlags | null {
    const [flags, setFlags] = useState<AuthFlags | null>(null);
    useEffect(() => {
        let live = true;
        fetch('/api/site/auth-flags')
            .then(r => r.json())
            .then((j: Record<string, unknown>) => {
                if (!live) return;
                setFlags({
                    providerMagicLink: Boolean(j.providerMagicLink ?? true),
                    providerCredentials: Boolean(j.providerCredentials),
                    providerGoogle: Boolean(j.providerGoogle),
                    providerFacebook: Boolean(j.providerFacebook),
                    providerApple: Boolean(j.providerApple),
                });
            })
            .catch(() => {
                if (live) setFlags({
                    providerMagicLink: true,
                    providerCredentials: false,
                    providerGoogle: false,
                    providerFacebook: false,
                    providerApple: false,
                });
            });
        return () => { live = false; };
    }, []);
    return flags;
}

function oauthList(flags: AuthFlags): OauthProvider[] {
    const out: OauthProvider[] = [];
    if (flags.providerGoogle) out.push('google');
    if (flags.providerApple) out.push('apple');
    if (flags.providerFacebook) out.push('facebook');
    return out;
}

/** Strip the `[retryMs=…]` lockout suffix the credentials provider appends. */
function cleanAuthError(raw: string): string {
    return raw.replace(/\s*\[retryMs=\d+\]\s*$/, '').trim() || 'Sign in failed';
}

function useReturnTo(paramNames: string[]): string {
    // App-Router-compatible query read via `useSearchParams()`. Works in
    // Pages Router too (Next 13+). Restrict to relative `/`-prefixed
    // values — same open-redirect guard the original `router.query` read
    // had implicitly via the `startsWith('/')` check.
    const search = useSearchParams();
    return useMemo(() => {
        for (const name of paramNames) {
            const v = search?.get(name) ?? null;
            if (typeof v === 'string' && v.startsWith('/')) return v;
        }
        return '/account';
    }, [search, paramNames]);
}

async function requestMagicLink(email: string, callbackUrl: string): Promise<{ok: true} | {ok: false; error: string}> {
    try {
        const res = await fetch('/api/auth/magic-request', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, callbackUrl}),
        });
        // 429 is intentionally treated as success — the response is
        // opaque by design (no account enumeration).
        if (!res.ok && res.status !== 429) {
            const data = await res.json().catch(() => ({}));
            return {ok: false, error: (data as {error?: string})?.error || 'Could not send the link, please try again'};
        }
        return {ok: true};
    } catch (e) {
        return {ok: false, error: (e as Error)?.message || 'Could not send the link, please try again'};
    }
}

// ── Sign-in ──────────────────────────────────────────────────────────

interface SigninFormContent {
    headline?: string;
    submitLabel?: string;
    forgotHref?: string;
    signupHref?: string;
}

export const SigninFormHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<SigninFormContent>(item.content);
    const flags = useAuthFlags();
    const returnTo = useReturnTo(['returnTo', 'callbackUrl']);

    if (!flags) return <p data-testid="account-signin-loading">Loading…</p>;

    const authMethods: SigninFormProps['authMethods'] = {
        password: flags.providerCredentials,
        magicLink: flags.providerMagicLink,
        oauth: oauthList(flags),
    };

    const onSubmit = async (sub: SigninFormSubmission): Promise<SigninFormResult | {ok: false; error: string}> => {
        if (!sub.password) {
            const res = await requestMagicLink(sub.email, returnTo);
            return res.ok ? {ok: true, next: 'magic-link-sent'} : {ok: false, error: res.error};
        }
        try {
            const res = await signIn('customer-credentials', {
                redirect: false,
                email: sub.email,
                password: sub.password,
                callbackUrl: returnTo,
            });
            if (res?.error) return {ok: false, error: cleanAuthError(res.error)};
            if (res?.ok) {
                window.location.href = res.url || returnTo;
                return {ok: true, next: 'session-set'};
            }
            return {ok: false, error: 'Sign in failed'};
        } catch (e) {
            return {ok: false, error: (e as Error)?.message || 'Sign in failed'};
        }
    };

    return (
        <div className="account-signin-host" style={wrapStyle} data-testid="account-signin-host">
            <SigninForm
                testId="account-signin"
                authMethods={authMethods}
                onSubmit={onSubmit}
                onOauthChoose={(provider: OauthProvider) => { void signIn(`customer-${provider}`, {callbackUrl: returnTo}); }}
                forgotHref={c.forgotHref}
                signupHref={c.signupHref ?? `/account/signup?callbackUrl=${encodeURIComponent(returnTo)}`}
                headline={c.headline}
                submitLabel={c.submitLabel}
            />
        </div>
    );
};

// ── Sign-up ──────────────────────────────────────────────────────────

interface SignupFormContent {
    headline?: string;
    submitLabel?: string;
    signinHref?: string;
    /** Hide the "buying for a business" toggle when false. Default true. */
    allowB2B?: boolean;
}

export const SignupFormHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<SignupFormContent>(item.content);
    const flags = useAuthFlags();
    const callbackUrl = useReturnTo(['callbackUrl', 'returnTo']);

    if (!flags) return <p data-testid="account-signup-loading">Loading…</p>;

    const authMethods: SignupFormProps['authMethods'] = {
        password: flags.providerCredentials,
        magicLink: flags.providerMagicLink,
        oauth: oauthList(flags),
    };

    const onSubmit = async (sub: SignupFormSubmission): Promise<SignupFormResult | {ok: false; error: string}> => {
        if (!sub.password) {
            const res = await requestMagicLink(sub.email, callbackUrl);
            return res.ok ? {ok: true, next: 'magic-link-sent'} : {ok: false, error: res.error};
        }
        try {
            const data = await gql(
                'mutation SignUp($customer: InUser!) { mongo { signUpCustomer(customer: $customer) } }',
                {customer: {email: sub.email, password: sub.password, name: sub.name, phone: undefined, kind: 'customer'}},
            );
            const env = parseEnvelope(data?.mongo?.signUpCustomer);
            if (env.error) return {ok: false, error: env.error};
            const newUserId = env?.createCustomer?.id as string | undefined;
            const isCompany = sub.customerType === 'company';
            if (newUserId) {
                void attachMarketingSessionToUser(newUserId);
                if (isCompany) {
                    // Audit-logged type flip via MCP, matching the legacy
                    // signup page. Best-effort — the customer can re-flip
                    // from /account/settings if this misses.
                    void mcpCall('customer.type.set', {userId: newUserId, type: 'company'}).catch(() => undefined);
                }
            }
            const dest = isCompany ? '/account/settings?tab=profile' : callbackUrl;
            const res = await signIn('customer-credentials', {
                redirect: false,
                email: sub.email,
                password: sub.password,
                callbackUrl: dest,
            });
            if (res?.ok) {
                window.location.href = res.url || dest || '/account';
                return {ok: true, next: 'verify-email-sent'};
            }
            window.location.href = '/account/signin?callbackUrl=' + encodeURIComponent(callbackUrl);
            return {ok: true, next: 'verify-email-sent'};
        } catch (e) {
            return {ok: false, error: (e as Error)?.message || 'Sign up failed'};
        }
    };

    return (
        <div className="account-signup-host" style={wrapStyle} data-testid="account-signup-host">
            <SignupForm
                testId="account-signup"
                authMethods={authMethods}
                allowB2B={c.allowB2B ?? true}
                onSubmit={onSubmit}
                onOauthChoose={(provider: OauthProvider) => { void signIn(`customer-${provider}`, {callbackUrl}); }}
                headline={c.headline}
                submitLabel={c.submitLabel}
                signinHref={c.signinHref ?? `/account/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            />
        </div>
    );
};

// ── Magic-link request ───────────────────────────────────────────────

interface MagicLinkRequestContent {
    headline?: string;
    body?: string;
    placeholder?: string;
    submitLabel?: string;
    successHeadline?: string;
    successBody?: string;
}

export const MagicLinkRequestFormHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<MagicLinkRequestContent>(item.content);
    const callbackUrl = useReturnTo(['callbackUrl', 'returnTo']);

    const onSubmit: MagicLinkRequestFormProps['onSubmit'] = async (email: string) => {
        const res = await requestMagicLink(email, callbackUrl);
        return res.ok ? {sent: true} : {sent: false, error: res.error};
    };

    return (
        <div className="account-magic-link-host" style={wrapStyle} data-testid="account-magic-link-host">
            <MagicLinkRequestForm
                testId="account-magic-link"
                onSubmit={onSubmit}
                headline={c.headline}
                body={c.body}
                placeholder={c.placeholder}
                submitLabel={c.submitLabel}
                successHeadline={c.successHeadline}
                successBody={c.successBody}
            />
        </div>
    );
};

// ── Customer verify (magic-link confirmation) ────────────────────────
//
// Module-composes `/account/verify` — the magic-link click-to-confirm
// page. Reads `?token=` and `?callbackUrl=` from useSearchParams() and
// drives NextAuth `signIn('customer-magic', …)` only on explicit button
// click. The defeat-pre-fetch contract (token consumed only on user
// POST, never on GET/HEAD email pre-fetch) is preserved because the
// signIn call lives inside an onClick handler, not in an effect.

interface CustomerVerifyContent {
    /** Card title (default: 'Confirm sign-in'). */
    headline?: string;
    /** Body line above the confirm button (default copy below). */
    body?: string;
    /** Confirm button label (default: 'Sign in to continue'). */
    submitLabel?: string;
    /** Error copy when no `?token=` is present in the URL. */
    missingTokenTitle?: string;
    /** Default callback URL when `?callbackUrl=` is absent. */
    defaultCallbackUrl?: string;
}

export const CustomerVerifyConfirmHost: React.FC<{item: IItem}> = ({item}) => {
    const c = parse<CustomerVerifyContent>(item.content);
    const sp = useSearchParams();
    const token = sp?.get('token') ?? null;
    const callbackUrl = sp?.get('callbackUrl') ?? (c.defaultCallbackUrl ?? '/account');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onConfirm = async (): Promise<void> => {
        if (!token) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await signIn('customer-magic', {redirect: false, token, callbackUrl});
            if (res?.ok) {
                try {
                    const session = await getSession();
                    const userId = (session?.user as {id?: string} | undefined)?.id;
                    if (userId) await attachMarketingSessionToUser(userId);
                } catch { /* attribution is best-effort */ }
            }
            if (res?.ok && res.url) {
                window.location.href = res.url;
            } else if (res?.ok) {
                window.location.href = callbackUrl;
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
        <div className="customer-verify-host" data-testid="customer-verify-host">
            <h2 style={{marginTop: 0, marginBottom: 16}}>{c.headline ?? 'Confirm sign-in'}</h2>
            {!token ? (
                <Alert
                    type="error"
                    showIcon
                    data-testid="customer-verify-no-token"
                    message={c.missingTokenTitle ?? 'Missing token'}
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
                        {c.body ?? 'Click the button below to finish signing in. This link can only be used once.'}
                    </p>
                    <Button type="primary" block onClick={onConfirm} loading={submitting} data-testid="customer-verify-confirm-btn">
                        {submitting ? <Spin size="small"/> : (c.submitLabel ?? 'Sign in to continue')}
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
    );
};
