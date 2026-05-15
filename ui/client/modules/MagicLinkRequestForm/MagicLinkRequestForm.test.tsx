// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import MagicLinkRequestForm from './MagicLinkRequestForm';

function fill(value: string) {
    fireEvent.change(screen.getByTestId('mlr-email'), {target: {value}});
}

describe('MagicLinkRequestForm', () => {
    it('renders form with default copy', () => {
        const onSubmit = vi.fn().mockResolvedValue({sent: true});
        render(<MagicLinkRequestForm testId="mlr" onSubmit={onSubmit} />);
        expect(screen.getByTestId('mlr')).toBeInTheDocument();
        expect(screen.getByTestId('mlr')).toHaveTextContent('Sign in with a magic link');
        expect(screen.getByTestId('mlr')).toHaveTextContent("We'll email you a one-click sign-in link.");
        expect(screen.getByTestId('mlr-submit')).toHaveTextContent('Email me a link');
    });

    it('blocks submit when email format is invalid', () => {
        const onSubmit = vi.fn().mockResolvedValue({sent: true});
        render(<MagicLinkRequestForm testId="mlr" onSubmit={onSubmit} />);
        fill('not-an-email');
        fireEvent.click(screen.getByTestId('mlr-submit'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('mlr-error')).toBeInTheDocument();
    });

    it('submits valid email; calls onSubmit with the trimmed value', async () => {
        const onSubmit = vi.fn().mockResolvedValue({sent: true});
        render(<MagicLinkRequestForm testId="mlr" onSubmit={onSubmit} />);
        fill('  alice@example.com  ');
        fireEvent.click(screen.getByTestId('mlr-submit'));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('alice@example.com'));
    });

    it('shows success state after onSubmit returns {sent: true}', async () => {
        const onSubmit = vi.fn().mockResolvedValue({sent: true});
        render(<MagicLinkRequestForm testId="mlr" onSubmit={onSubmit} />);
        fill('alice@example.com');
        fireEvent.click(screen.getByTestId('mlr-submit'));
        await waitFor(() => expect(screen.getByTestId('mlr-success')).toBeInTheDocument());
        expect(screen.getByTestId('mlr-success')).toHaveTextContent('Check your inbox');
        expect(screen.queryByTestId('mlr-submit')).not.toBeInTheDocument();
    });

    it('shows error after onSubmit returns {sent: false, error}', async () => {
        const onSubmit = vi.fn().mockResolvedValue({sent: false, error: 'rate-limited'});
        render(<MagicLinkRequestForm testId="mlr" onSubmit={onSubmit} />);
        fill('alice@example.com');
        fireEvent.click(screen.getByTestId('mlr-submit'));
        await waitFor(() => expect(screen.getByTestId('mlr-error')).toHaveTextContent('rate-limited'));
    });

    it('re-submits after error correctly', async () => {
        const onSubmit = vi.fn()
            .mockResolvedValueOnce({sent: false, error: 'rate-limited'})
            .mockResolvedValueOnce({sent: true});
        render(<MagicLinkRequestForm testId="mlr" onSubmit={onSubmit} />);
        fill('alice@example.com');
        fireEvent.click(screen.getByTestId('mlr-submit'));
        await waitFor(() => expect(screen.getByTestId('mlr-error')).toBeInTheDocument());
        fireEvent.click(screen.getByTestId('mlr-submit'));
        await waitFor(() => expect(screen.getByTestId('mlr-success')).toBeInTheDocument());
        expect(onSubmit).toHaveBeenCalledTimes(2);
    });

    it('disables submit during in-flight', async () => {
        let resolve: (v: {sent: true}) => void = () => {};
        const onSubmit = vi.fn(() => new Promise<{sent: true}>(r => { resolve = r; }));
        render(<MagicLinkRequestForm testId="mlr" onSubmit={onSubmit} />);
        fill('alice@example.com');
        fireEvent.click(screen.getByTestId('mlr-submit'));
        await waitFor(() => expect(screen.getByTestId('mlr-submit')).toBeDisabled());
        resolve({sent: true});
        await waitFor(() => expect(screen.getByTestId('mlr-success')).toBeInTheDocument());
    });
});
