import React, {useState} from 'react';
import {GetServerSideProps} from 'next';
import {Alert, Button, Divider, Form, Input} from 'antd';
import {GoogleOutlined} from '@ant-design/icons';

/** Admin NextAuth instance lives at `/api/admin/auth/*` (auth-split Phase 1.A).
 *  next-auth/react's `signIn()` targets the default `/api/auth/*` base path
 *  (customer instance) — which doesn't have the `admin-credentials` provider.
 *  This helper does the credentials handshake against the admin instance
 *  manually: CSRF fetch → form POST → JSON `{url}` response. Mirrors what
 *  next-auth/react does internally with `json=true` + `redirect=false`. */
const ADMIN_AUTH_BASE = '/api/admin/auth';

async function signInAdminCredentials(email: string, password: string, callbackUrl: string): Promise<{ok: boolean; url?: string; error?: string}> {
    const csrfRes = await fetch(`${ADMIN_AUTH_BASE}/csrf`, {credentials: 'include'});
    if (!csrfRes.ok) return {ok: false, error: 'csrf-fetch-failed'};
    const {csrfToken} = await csrfRes.json();
    const body = new URLSearchParams({csrfToken, email, password, callbackUrl, json: 'true'});
    const res = await fetch(`${ADMIN_AUTH_BASE}/callback/admin-credentials`, {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json'},
        body: body.toString(),
        redirect: 'follow',
    });
    if (!res.ok) {
        let err = `signin-${res.status}`;
        try { const j = await res.json(); err = j.error ?? err; } catch { /* ignore */ }
        return {ok: false, error: err};
    }
    const data = await res.json().catch(() => ({}));
    const url = typeof data?.url === 'string' ? data.url : callbackUrl;
    // NextAuth signals failure by redirecting back to /api/admin/auth/signin?error=...
    if (url.includes('/api/admin/auth/signin') || url.includes('error=')) {
        const m = url.match(/error=([^&]+)/);
        return {ok: false, error: m ? decodeURIComponent(m[1]) : 'credentials-rejected'};
    }
    return {ok: true, url};
}

function adminGoogleHref(callbackUrl: string): string {
    return `${ADMIN_AUTH_BASE}/signin/admin-google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

/**
 * Admin sign-in page — auth-split-client-admin (Phase 1.A).
 *
 * Credentials-first UX targeting the operator. Google OAuth is
 * surfaced as a secondary option when `AUTH_GOOGLE_*` env vars are
 * present. No magic-link surface — admin threat-model rejects
 * passwordless for privileged accounts. Submits to
 * `/api/admin/auth/callback/<provider>` (admin NextAuth instance).
 *
 * Supports `?returnTo=` query param. Defaults to `/admin` on success.
 */
const AdminSignInPage = ({returnTo, googleEnabled}: {returnTo: string; googleEnabled: boolean}) => {
    const [submitting, setSubmitting] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    const onFinish = async (values: {email: string; password: string}) => {
        setSubmitting(true);
        setErrorText(null);
        try {
            const res = await signInAdminCredentials(values.email, values.password, returnTo);
            if (!res.ok) {
                setErrorText((res.error || 'Sign in failed').replace(/\s*\[retryMs=\d+\]\s*$/, '').trim() || 'Sign in failed');
            } else if (res.url) {
                window.location.href = res.url;
            }
        } catch (e: any) {
            setErrorText(e?.message || 'Sign in failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f5f5f5'}}>
            <div style={{width: '100%', maxWidth: 380, background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                <h2 style={{marginTop: 0, marginBottom: 16}}>Admin sign in</h2>
                {errorText ? <Alert type="error" showIcon style={{marginBottom: 12}} message={errorText} data-testid="admin-signin-error"/> : null}
                <Form layout="vertical" onFinish={onFinish}>
                    <Form.Item label="Email" name="email" rules={[{required: true, type: 'email'}]}>
                        <Input autoComplete="email" autoFocus data-testid="admin-signin-email-input"/>
                    </Form.Item>
                    <Form.Item label="Password" name="password" rules={[{required: true}]}>
                        <Input.Password autoComplete="current-password" data-testid="admin-signin-password-input"/>
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={submitting} data-testid="admin-signin-submit-btn">
                        Sign in
                    </Button>
                </Form>
                {googleEnabled && (
                    <>
                        <Divider plain>or</Divider>
                        <Button
                            block
                            icon={<GoogleOutlined/>}
                            onClick={() => { window.location.href = adminGoogleHref(returnTo); }}
                            data-testid="admin-signin-google-btn"
                        >
                            Continue with Google
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
};

export const getServerSideProps: GetServerSideProps = async ({query}) => {
    const returnTo = typeof query.returnTo === 'string' && query.returnTo.startsWith('/')
        ? query.returnTo
        : '/admin';
    return {
        props: {
            returnTo,
            googleEnabled: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET),
        },
    };
};

export default AdminSignInPage;
