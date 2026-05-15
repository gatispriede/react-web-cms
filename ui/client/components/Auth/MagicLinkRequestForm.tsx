import React, {useState} from 'react';
import {Alert, Button, Form, Input, Result} from 'antd';

/**
 * Reusable magic-link request form. Extracted from the original
 * `/account/magic-link.tsx` page so the same UI can embed inside
 * `/account/signin` (magic-link-first UX), the order-by-token page,
 * or any custom Auth surface.
 *
 * POSTs to `/api/auth/magic-request` (W6c) — that endpoint mints a
 * single-use token, emails it, and the link returns to
 * `/account/verify?token=...` which calls `signIn('customer-magic')`.
 *
 * 2026-05-15: re-skinned with AntD so the form picks up the
 * storefront theme (was raw HTML elements; rendered as bare
 * unstyled inputs inside `/account/signin`).
 */
export const MagicLinkRequestForm: React.FC<{returnTo?: string; autoFocus?: boolean}> = ({returnTo, autoFocus}) => {
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState<{email: string} | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [form] = Form.useForm<{email: string}>();

    const onFinish = async ({email}: {email: string}) => {
        if (!email) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/auth/magic-request', {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                body: JSON.stringify({email, returnTo}),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data?.error ?? `Failed: ${res.status}`);
            } else {
                setSent({email});
            }
        } catch (err) {
            setError(String((err as Error).message || err));
        } finally {
            setSubmitting(false);
        }
    };

    if (sent) {
        return (
            <Result
                status="success"
                title="Check your email"
                subTitle={<>We sent a sign-in link to <strong>{sent.email}</strong>.</>}
                data-testid="magic-link-sent"
                style={{padding: '12px 0'}}
            />
        );
    }

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            data-testid="magic-link-form"
            requiredMark={false}
        >
            <Form.Item
                label="Email"
                name="email"
                rules={[
                    {required: true, message: 'Email is required'},
                    {type: 'email', message: 'Enter a valid email'},
                ]}
            >
                <Input
                    type="email"
                    autoComplete="email"
                    autoFocus={autoFocus}
                    placeholder="you@example.com"
                    data-testid="magic-link-email-input"
                    size="large"
                />
            </Form.Item>
            {error && (
                <Alert
                    type="error"
                    showIcon
                    message={error}
                    style={{marginBottom: 12}}
                    data-testid="magic-link-error"
                />
            )}
            <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={submitting}
                data-testid="magic-link-submit"
            >
                Email me a sign-in link
            </Button>
        </Form>
    );
};

export default MagicLinkRequestForm;
