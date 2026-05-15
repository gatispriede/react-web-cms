// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import SignupForm from './SignupForm';

function changeVal(testid: string, value: string) {
    fireEvent.change(screen.getByTestId(testid), {target: {value}});
}

describe('SignupForm', () => {
    it('renders password field when authMethods.password=true', () => {
        const onSubmit = vi.fn();
        render(<SignupForm testId="su" authMethods={{password: true}} onSubmit={onSubmit} />);
        expect(screen.getByTestId('su')).toBeInTheDocument();
        expect(screen.getByTestId('su-password')).toBeInTheDocument();
    });

    it('hides password field when authMethods.password=false', () => {
        const onSubmit = vi.fn();
        render(<SignupForm testId="su" authMethods={{magicLink: true}} onSubmit={onSubmit} />);
        expect(screen.queryByTestId('su-password')).not.toBeInTheDocument();
    });

    it('B2B toggle hides company-name + vat-id until clicked', () => {
        const onSubmit = vi.fn();
        render(<SignupForm testId="su" authMethods={{password: true}} allowB2B onSubmit={onSubmit} />);
        expect(screen.queryByTestId('su-company-name')).not.toBeInTheDocument();
        expect(screen.queryByTestId('su-vat-id')).not.toBeInTheDocument();
        fireEvent.click(screen.getByTestId('su-b2b-toggle'));
        expect(screen.getByTestId('su-company-name')).toBeInTheDocument();
        expect(screen.getByTestId('su-vat-id')).toBeInTheDocument();
    });

    it('blocks submit on missing required fields', () => {
        const onSubmit = vi.fn();
        render(<SignupForm testId="su" authMethods={{password: true}} onSubmit={onSubmit} />);
        fireEvent.click(screen.getByTestId('su-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('su-error')).toBeInTheDocument();
    });

    it('blocks submit on invalid email', () => {
        const onSubmit = vi.fn();
        render(<SignupForm testId="su" authMethods={{password: true}} onSubmit={onSubmit} />);
        changeVal('su-email', 'not-email');
        changeVal('su-name', 'Alice');
        changeVal('su-password', 'longenough');
        fireEvent.click(screen.getByTestId('su-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('su-error')).toBeInTheDocument();
    });

    it('blocks submit when password < 8 chars', () => {
        const onSubmit = vi.fn();
        render(<SignupForm testId="su" authMethods={{password: true}} onSubmit={onSubmit} />);
        changeVal('su-email', 'a@b.co');
        changeVal('su-name', 'Alice');
        changeVal('su-password', 'short');
        fireEvent.click(screen.getByTestId('su-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('su-error')).toHaveTextContent(/8 characters/);
    });

    it('renders success state after onSubmit resolves ok', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ok: true, next: 'verify-email-sent'});
        render(<SignupForm testId="su" authMethods={{password: true}} onSubmit={onSubmit} />);
        changeVal('su-email', 'alice@example.com');
        changeVal('su-name', 'Alice');
        changeVal('su-password', 'longenough');
        fireEvent.click(screen.getByTestId('su-submit'));
        await waitFor(() => expect(screen.getByTestId('su-success')).toBeInTheDocument());
    });

    it('surfaces error on {ok: false, error}', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ok: false, error: 'email-taken'});
        render(<SignupForm testId="su" authMethods={{password: true}} onSubmit={onSubmit} />);
        changeVal('su-email', 'alice@example.com');
        changeVal('su-name', 'Alice');
        changeVal('su-password', 'longenough');
        fireEvent.click(screen.getByTestId('su-submit'));
        await waitFor(() => expect(screen.getByTestId('su-error')).toHaveTextContent('email-taken'));
    });

    it('hides OAuth stack when oauth array empty / undefined', () => {
        const onSubmit = vi.fn();
        render(<SignupForm testId="su" authMethods={{password: true, oauth: []}} onSubmit={onSubmit} />);
        expect(screen.queryByTestId('su-oauth')).not.toBeInTheDocument();
    });

    it('renders OAuth stack and signin link when configured', () => {
        const onSubmit = vi.fn();
        render(
            <SignupForm
                testId="su"
                authMethods={{password: true, oauth: ['google']}}
                onSubmit={onSubmit}
                signinHref="/account/signin"
            />,
        );
        expect(screen.getByTestId('su-oauth')).toBeInTheDocument();
        expect(screen.getByTestId('su-signin-link')).toHaveAttribute('href', '/account/signin');
    });
});
