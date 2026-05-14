// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import SigninForm from './SigninForm';

function changeVal(testid: string, value: string) {
    fireEvent.change(screen.getByTestId(testid), {target: {value}});
}

describe('SigninForm', () => {
    it('renders with password field when authMethods.password=true', () => {
        const onSubmit = vi.fn();
        render(<SigninForm testId="si" authMethods={{password: true}} onSubmit={onSubmit} />);
        expect(screen.getByTestId('si')).toBeInTheDocument();
        expect(screen.getByTestId('si-password')).toBeInTheDocument();
    });

    it('hides password field when not in authMethods', () => {
        const onSubmit = vi.fn();
        render(<SigninForm testId="si" authMethods={{magicLink: true}} onSubmit={onSubmit} />);
        expect(screen.queryByTestId('si-password')).not.toBeInTheDocument();
    });

    it('blocks submit on missing email', () => {
        const onSubmit = vi.fn();
        render(<SigninForm testId="si" authMethods={{password: true}} onSubmit={onSubmit} />);
        fireEvent.click(screen.getByTestId('si-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('si-error')).toBeInTheDocument();
    });

    it('renders success state after onSubmit ok', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ok: true, next: 'session-set'});
        render(<SigninForm testId="si" authMethods={{password: true}} onSubmit={onSubmit} />);
        changeVal('si-email', 'alice@example.com');
        changeVal('si-password', 'pw');
        fireEvent.click(screen.getByTestId('si-submit'));
        await waitFor(() => expect(screen.getByTestId('si-success')).toBeInTheDocument());
    });

    it('surfaces error on onSubmit failure', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ok: false, error: 'bad-credentials'});
        render(<SigninForm testId="si" authMethods={{password: true}} onSubmit={onSubmit} />);
        changeVal('si-email', 'alice@example.com');
        changeVal('si-password', 'pw');
        fireEvent.click(screen.getByTestId('si-submit'));
        await waitFor(() => expect(screen.getByTestId('si-error')).toHaveTextContent('bad-credentials'));
    });

    it('hides OAuth stack when oauth array empty', () => {
        const onSubmit = vi.fn();
        render(<SigninForm testId="si" authMethods={{password: true, oauth: []}} onSubmit={onSubmit} />);
        expect(screen.queryByTestId('si-oauth')).not.toBeInTheDocument();
    });

    it('magic-link toggle swaps to email-only submit', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ok: true, next: 'magic-link-sent'});
        render(<SigninForm testId="si" authMethods={{password: true, magicLink: true}} onSubmit={onSubmit} />);
        expect(screen.getByTestId('si-password')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('si-magic-link-toggle'));
        expect(screen.queryByTestId('si-password')).not.toBeInTheDocument();
        changeVal('si-email', 'alice@example.com');
        fireEvent.click(screen.getByTestId('si-submit'));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({email: 'alice@example.com'}));
    });

    it('renders signup + forgot links when configured', () => {
        const onSubmit = vi.fn();
        render(
            <SigninForm
                testId="si"
                authMethods={{password: true}}
                onSubmit={onSubmit}
                forgotHref="/account/forgot"
                signupHref="/account/signup"
            />,
        );
        expect(screen.getByTestId('si-forgot-link')).toHaveAttribute('href', '/account/forgot');
        expect(screen.getByTestId('si-signup-link')).toHaveAttribute('href', '/account/signup');
    });
});
