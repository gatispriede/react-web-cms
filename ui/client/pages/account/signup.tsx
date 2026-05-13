import React, {useState} from 'react';
import {GetServerSideProps} from 'next';
import Link from 'next/link';
import {signIn} from 'next-auth/react';
import {Alert, Button, Form, Input, Switch} from 'antd';
import {gql, parseEnvelope} from '@client/lib/account/gqlClient';
import {attachMarketingSessionToUser} from '@client/lib/marketingCapture';
import {SiteFlagsService} from '@services/features/Seo/SiteFlagsService';
import {getMongoConnection} from '@services/infra/mongoDBConnection';
import {mcpCall} from '@client/components/AccountSettings/mcpClient';

/**
 * Signup form — extended (Phase 1.E client-account-settings-page)
 * with an optional "I'm buying for a business" toggle that flips the
 * fresh customer record to `customerType: 'company'`. The default
 * comes from `commerce.defaultCustomerType` (`'client'` |
 * `'company'` | `'ask'`); `'ask'` mode forces the user to pick by
 * preselecting nothing.
 */
interface SignUpPageProps {
    callbackUrl: string;
    defaultType: 'client' | 'company' | 'ask';
}

const SignUpPage = ({callbackUrl, defaultType}: SignUpPageProps) => {
    const [submitting, setSubmitting] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [isCompany, setIsCompany] = useState(defaultType === 'company');

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
            const newUserId = env?.createCustomer?.id;
            if (newUserId) {
                void attachMarketingSessionToUser(newUserId);
                if (isCompany) {
                    // Stamp the discriminator via the MCP tool so the
                    // type-switch is audit-logged like every other
                    // operator-driven flip. Best-effort — failure
                    // here doesn't block sign-in, the user can flip
                    // later from /account/settings.
                    void mcpCall('customer.type.set', {userId: newUserId, type: 'company'}).catch(() => undefined);
                }
            }
            const res = await signIn('customer-credentials', {
                redirect: false,
                email: values.email,
                password: values.password,
                callbackUrl: isCompany ? '/account/settings?tab=profile' : callbackUrl,
            });
            if (res?.ok) {
                window.location.href = res.url || (isCompany ? '/account/settings?tab=profile' : callbackUrl) || '/account';
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
                    <Form.Item label="I'm buying for a business">
                        <Switch
                            checked={isCompany}
                            onChange={setIsCompany}
                            data-testid="customer-signup-company-toggle"
                        />
                    </Form.Item>
                    {defaultType === 'ask' && (
                        <Alert
                            type="info"
                            showIcon
                            style={{marginBottom: 12}}
                            message="Please confirm whether you're buying as an individual or a business."
                            data-testid="customer-signup-ask-banner"
                        />
                    )}
                    <Button type="primary" htmlType="submit" block loading={submitting} data-testid="customer-signup-submit-btn">Create account</Button>
                </Form>
                <div style={{marginTop: 16, textAlign: 'center'}}>
                    Already have an account? <Link href={`/account/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Sign in</Link>
                </div>
            </div>
        </div>
    );
};

export const getServerSideProps: GetServerSideProps<SignUpPageProps> = async ({query}) => {
    const cb = typeof query.callbackUrl === 'string' ? query.callbackUrl : '/account';
    let defaultType: 'client' | 'company' | 'ask' = 'client';
    try {
        const conn = getMongoConnection() as unknown as {database?: never};
        if (conn.database) {
            const flags = new SiteFlagsService(conn.database as never);
            const blob = await flags.get();
            const sub = (blob?.commerce ?? {}) as Record<string, unknown>;
            const v = sub.defaultCustomerType;
            if (v === 'client' || v === 'company' || v === 'ask') defaultType = v;
        }
    } catch {
        // Best-effort — signup must remain reachable when the flag
        // service is unavailable. Falls back to 'client' (lower
        // friction per W6c research).
    }
    return {props: {callbackUrl: cb, defaultType}};
};

export default SignUpPage;
