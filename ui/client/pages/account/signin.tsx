import React, {useEffect, useMemo, useRef, useState} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import {signIn} from 'next-auth/react';
import {Alert, Button, Divider, Form, Input} from 'antd';
import {GoogleOutlined} from '@ant-design/icons';

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

const CustomerSignInPage = ({callbackUrl, googleEnabled}: {callbackUrl: string; googleEnabled: boolean}) => {
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

    const onFinish = async (values: {email: string; password: string}) => {
        if (isLocked) return;
        setSubmitting(true);
        setErrorText(null);
        try {
            const res = await signIn('customer-credentials', {
                redirect: false,
                email: values.email,
                password: values.password,
                callbackUrl,
            });
            if (res?.error) {
                const {message, retryMs} = parseError(res.error);
                setErrorText(message || 'Sign in failed');
                if (retryMs > 0) {
                    setLockedUntil(Date.now() + retryMs);
                    setNow(Date.now());
                }
            } else if (res?.ok) {
                window.location.href = res.url || callbackUrl || '/account';
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

    return (
        <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f5f5f5'}}>
            <div style={{width: '100%', maxWidth: 380, background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                <h2 style={{marginTop: 0, marginBottom: 16}}>Sign in</h2>
                {errorText ? <Alert type="error" showIcon style={{marginBottom: 12}} message={errorText}/> : null}
                {lockedBanner}
                <Form layout="vertical" onFinish={onFinish} disabled={isLocked || submitting}>
                    <Form.Item label="Email" name="email" rules={[{required: true, type: 'email'}]}>
                        <Input autoComplete="email" autoFocus data-testid="customer-signin-email-input"/>
                    </Form.Item>
                    <Form.Item label="Password" name="password" rules={[{required: true}]}>
                        <Input.Password autoComplete="current-password" data-testid="customer-signin-password-input"/>
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={submitting} disabled={isLocked} data-testid="customer-signin-submit-btn">
                        {isLocked ? `Try again in ${formatRemaining(remainingMs)}` : 'Sign in'}
                    </Button>
                </Form>
                {googleEnabled && (
                    <>
                        <Divider plain>or</Divider>
                        <Button
                            block
                            icon={<GoogleOutlined/>}
                            onClick={() => signIn('customer-google', {callbackUrl})}
                        >
                            Continue with Google
                        </Button>
                    </>
                )}
                <div style={{marginTop: 16, textAlign: 'center'}}>
                    <Link href={`/account/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Create an account</Link>
                </div>
            </div>
        </div>
    );
};

export const getServerSideProps: GetServerSideProps = async ({query}) => {
    const cb = typeof query.callbackUrl === 'string' ? query.callbackUrl : '/account';
    return {
        props: {
            callbackUrl: cb,
            googleEnabled: Boolean(process.env.AUTH_CUSTOMER_GOOGLE_ID && process.env.AUTH_CUSTOMER_GOOGLE_SECRET),
        },
    };
};

export default CustomerSignInPage;
