import React, {useState} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import {signIn} from 'next-auth/react';
import {Alert, Button, Form, Input} from 'antd';
import {gql, parseEnvelope} from '@client/lib/account/gqlClient';

const SignUpPage = ({callbackUrl}: {callbackUrl: string}) => {
    const [submitting, setSubmitting] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);

    const onFinish = async (values: {name?: string; email: string; password: string; phone?: string}) => {
        setSubmitting(true);
        setErrorText(null);
        try {
            const data = await gql(
                `mutation SignUp($customer: InUser!) {
                    mongo { signUpCustomer(customer: $customer) }
                }`,
                {customer: {email: values.email, password: values.password, name: values.name, phone: values.phone, kind: 'customer'}},
            );
            const env = parseEnvelope(data?.mongo?.signUpCustomer);
            if (env.error) {
                setErrorText(env.error);
                return;
            }
            // Auto-sign-in via the customer credentials provider so the
            // user lands at `/account` already authenticated rather than
            // being bounced to the sign-in page.
            const res = await signIn('customer-credentials', {
                redirect: false,
                email: values.email,
                password: values.password,
                callbackUrl,
            });
            if (res?.ok) {
                window.location.href = res.url || callbackUrl || '/account';
            } else {
                window.location.href = '/account/signin?callbackUrl=' + encodeURIComponent(callbackUrl);
            }
        } catch (e: any) {
            setErrorText(e?.message || 'Sign up failed');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f5f5f5'}}>
            <div style={{width: '100%', maxWidth: 420, background: '#fff', padding: 24, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)'}}>
                <h2 style={{marginTop: 0, marginBottom: 16}}>Create your account</h2>
                {errorText ? <Alert type="error" showIcon style={{marginBottom: 12}} message={errorText}/> : null}
                <Form layout="vertical" onFinish={onFinish} disabled={submitting}>
                    <Form.Item label="Name" name="name">
                        <Input autoComplete="name" data-testid="customer-signup-name-input"/>
                    </Form.Item>
                    <Form.Item label="Email" name="email" rules={[{required: true, type: 'email'}]}>
                        <Input autoComplete="email" data-testid="customer-signup-email-input"/>
                    </Form.Item>
                    <Form.Item label="Password" name="password" rules={[{required: true, min: 8}]}>
                        <Input.Password autoComplete="new-password" data-testid="customer-signup-password-input"/>
                    </Form.Item>
                    <Form.Item label="Phone" name="phone">
                        <Input autoComplete="tel" data-testid="customer-signup-phone-input"/>
                    </Form.Item>
                    <Button type="primary" htmlType="submit" block loading={submitting} data-testid="customer-signup-submit-btn">Create account</Button>
                </Form>
                <div style={{marginTop: 16, textAlign: 'center'}}>
                    Already have an account? <Link href={`/account/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Sign in</Link>
                </div>
            </div>
        </div>
    );
};

export const getServerSideProps: GetServerSideProps = async ({query}) => {
    const cb = typeof query.callbackUrl === 'string' ? query.callbackUrl : '/account';
    return {props: {callbackUrl: cb}};
};

export default SignUpPage;
