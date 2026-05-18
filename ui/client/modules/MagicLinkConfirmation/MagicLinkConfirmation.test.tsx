// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import MagicLinkConfirmation from './MagicLinkConfirmation';

describe('MagicLinkConfirmation', () => {
    it('renders headline + body + button by default', () => {
        const onConfirm = vi.fn().mockResolvedValue({ok: true});
        render(<MagicLinkConfirmation testId="mlc" token="tok123" onConfirm={onConfirm} />);
        expect(screen.getByTestId('mlc')).toHaveTextContent('One last step');
        expect(screen.getByTestId('mlc')).toHaveTextContent('Click below to finish signing in.');
        expect(screen.getByTestId('mlc-confirm')).toBeInTheDocument();
    });

    it('click triggers onConfirm(token) exactly once', async () => {
        const onConfirm = vi.fn().mockResolvedValue({ok: true});
        render(<MagicLinkConfirmation testId="mlc" token="tok123" onConfirm={onConfirm} />);
        fireEvent.click(screen.getByTestId('mlc-confirm'));
        await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('tok123'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('on {ok: true}: success state visible; confirm hidden', async () => {
        const onConfirm = vi.fn().mockResolvedValue({ok: true});
        render(<MagicLinkConfirmation testId="mlc" token="tok123" onConfirm={onConfirm} />);
        fireEvent.click(screen.getByTestId('mlc-confirm'));
        await waitFor(() => expect(screen.getByTestId('mlc-success')).toBeInTheDocument());
        expect(screen.queryByTestId('mlc-confirm')).not.toBeInTheDocument();
    });

    it('on {ok: false}: error shown; confirm still clickable', async () => {
        const onConfirm = vi.fn()
            .mockResolvedValueOnce({ok: false, error: 'expired'})
            .mockResolvedValueOnce({ok: true});
        render(<MagicLinkConfirmation testId="mlc" token="tok123" onConfirm={onConfirm} />);
        fireEvent.click(screen.getByTestId('mlc-confirm'));
        await waitFor(() => expect(screen.getByTestId('mlc-error')).toHaveTextContent('expired'));
        expect(screen.getByTestId('mlc-confirm')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('mlc-confirm'));
        await waitFor(() => expect(screen.getByTestId('mlc-success')).toBeInTheDocument());
    });

    it('empty token shows error (token-missing guard)', () => {
        const onConfirm = vi.fn();
        render(<MagicLinkConfirmation testId="mlc" token="" onConfirm={onConfirm} />);
        fireEvent.click(screen.getByTestId('mlc-confirm'));
        expect(screen.getByTestId('mlc-error')).toBeInTheDocument();
        expect(onConfirm).not.toHaveBeenCalled();
    });

    it('button disabled during in-flight verify', async () => {
        let resolve: (v: {ok: true}) => void = () => {};
        const onConfirm = vi.fn(() => new Promise<{ok: true}>(r => { resolve = r; }));
        render(<MagicLinkConfirmation testId="mlc" token="tok123" onConfirm={onConfirm} />);
        fireEvent.click(screen.getByTestId('mlc-confirm'));
        await waitFor(() => expect(screen.getByTestId('mlc-confirm')).toBeDisabled());
        resolve({ok: true});
        await waitFor(() => expect(screen.getByTestId('mlc-success')).toBeInTheDocument());
    });
});
