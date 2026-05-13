import React, {useState} from 'react';
import {GetServerSideProps} from 'next';
import {signIn} from 'next-auth/react';
import {Alert, Button, Divider, Form, Input} from 'antd';
import {GoogleOutlined} from '@ant-design/icons';

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
            const res = await signIn('admin-credentials', {
                redirect: false,
                email: values.email,
                password: values.password,
                callbackUrl: returnTo,
            });
            if (res?.error) {
                setErrorText(res.error.replace(/\s*\[retryMs=\d+\]\s*$/, '').trim() || 'Sign in failed');
            } else if (res?.ok) {
                window.location.href = res.url || returnTo;
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
                            onClick={() => signIn('admin-google', {callbackUrl: returnTo})}
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
