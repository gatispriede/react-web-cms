import React, {useEffect, useMemo, useRef, useState} from 'react';
import {GetServerSideProps} from 'next';
import {signIn} from 'next-auth/react';
import {Alert, Button, Form, Input} from 'antd';
import {serverSideTranslations} from 'next-i18next/pages/serverSideTranslations';
import {useTranslation} from 'next-i18next/pages';

// Parse out the `[retryMs=N]` marker that authOptions appends to lockout/
// wrong-password errors. Two outputs: the human prose with the marker
// stripped, and the wait duration in ms (0 if absent).
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

const SignInPage = ({callbackUrl}: {callbackUrl: string}) => {
    const {t} = useTranslation('common');
    const [submitting, setSubmitting] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [lockedUntil, setLockedUntil] = useState<number>(0);
    const [now, setNow] = useState<number>(() => Date.now());
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Drive a 1s tick only while a lockout is active. We stop the interval as
    // soon as the wait elapses so we're not burning timers when idle.
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
            const res = await signIn('admin-credentials', {
                redirect: false,
                email: values.email,
                password: values.password,
                callbackUrl,
            });
            if (res?.error) {
                const {message, retryMs} = parseError(res.error);
                setErrorText(message || t('Sign in failed'));
                if (retryMs > 0) {
                    setLockedUntil(Date.now() + retryMs);
                    setNow(Date.now());
                }
            } else if (res?.ok) {
                window.location.href = res.url || callbackUrl || '/admin';
            }
        } catch (e: any) {
            setErrorText(e?.message || t('Sign in failed'));
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
                message={t('Account temporarily locked')}
                description={`${t('Try again in')} ${formatRemaining(remainingMs)}`}
            />
        );
    }, [isLocked, remainingMs, t]);

    return (
        <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f5f5f5'}}>
            <div style={{width: '100%', maxWidth: 380, background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                <h2 style={{marginTop: 0, marginBottom: 16}}>{t('Sign in')}</h2>
                {/* Reason (e.g. "Wrong email or password") is always shown so the
                    user understands WHY they're locked, not just that they are.
                    The countdown banner sits below it and ticks live. */}
                {errorText ? (
                    <Alert type="error" showIcon style={{marginBottom: 12}} message={errorText}/>
                ) : null}
                {lockedBanner}
                <Form layout="vertical" onFinish={onFinish} disabled={isLocked || submitting}>
                    <Form.Item
                        label={t('Email')}
                        name="email"
                        rules={[{required: true, type: 'email'}]}
                    >
                        <Input autoComplete="email" autoFocus/>
                    </Form.Item>
                    <Form.Item
                        label={t('Password')}
                        name="password"
                        rules={[{required: true}]}
                    >
                        <Input.Password autoComplete="current-password"/>
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={submitting} disabled={isLocked}>
                        {isLocked
                            ? `${t('Try again in')} ${formatRemaining(remainingMs)}`
                            : t('Sign in')}
                    </Button>
                </Form>
            </div>
        </div>
    );
};

export const getServerSideProps: GetServerSideProps = async ({query, locale}) => {
    const cb = typeof query.callbackUrl === 'string' ? query.callbackUrl : '/admin';
    return {
        props: {
            callbackUrl: cb,
            ...(await serverSideTranslations(locale ?? 'en', ['common', 'app'])),
        },
    };
};

export default SignInPage;
