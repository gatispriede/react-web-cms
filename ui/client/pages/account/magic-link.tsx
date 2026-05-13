import React, {useState} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import {Alert, Button, Form, Input} from 'antd';

/**
 * W6c — magic-link request page. Posts to `/api/auth/magic-request`
 * which issues a token and emails it via the magic-link template +
 * EmailService. Response is intentionally opaque (no enumeration) — we
 * always show the same "check your inbox" copy regardless of whether
 * the email exists.
 */
const MagicLinkRequestPage = ({callbackUrl}: {callbackUrl: string}) => {
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onFinish = async (values: {email: string}) => {
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/magic-request', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email: values.email, callbackUrl}),
            });
            if (!res.ok && res.status !== 429) {
                const data = await res.json().catch(() => ({}));
                setError(data?.error || 'Could not send the link, please try again');
                return;
            }
            setSent(true);
        } catch (e: any) {
            setError(e?.message || 'Could not send the link, please try again');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f5f5f5'}}>
            <div style={{width: '100%', maxWidth: 420, background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                <h2 style={{marginTop: 0, marginBottom: 16}}>Sign in with a magic link</h2>
                {sent ? (
                    <Alert
                        type="success"
                        showIcon
                        data-testid="customer-magic-link-sent"
                        message="Check your email"
                        description="If this email is registered, we just sent you a sign-in link. It expires in 15 minutes."
                    />
                ) : (
                    <>
                        {error ? <Alert type="error" showIcon style={{marginBottom: 12}} message={error}/> : null}
                        <Form layout="vertical" onFinish={onFinish} disabled={submitting}>
                            <Form.Item label="Email" name="email" rules={[{required: true, type: 'email'}]}>
                                <Input autoComplete="email" data-testid="customer-magic-email-input"/>
                            </Form.Item>
                            <Button type="primary" htmlType="submit" block loading={submitting} data-testid="customer-magic-submit-btn">
                                Email me a sign-in link
                            </Button>
                        </Form>
                        <div style={{marginTop: 16, textAlign: 'center'}}>
                            <Link href={`/account/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Use a password instead</Link>
                            {' · '}
                            <Link href={`/account/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Create an account</Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export const getServerSideProps: GetServerSideProps = async ({query}) => {
    const cb = typeof query.callbackUrl === 'string' ? query.callbackUrl : '/account';
    return {props: {callbackUrl: cb}};
};

export default MagicLinkRequestPage;
