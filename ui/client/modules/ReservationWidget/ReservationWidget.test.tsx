// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import ReservationWidget from './ReservationWidget';

const fill = (testId: string, overrides: Partial<Record<string, string>> = {}) => {
    fireEvent.change(screen.getByTestId(`${testId}-date`), {target: {value: overrides.date ?? '2026-06-01'}});
    fireEvent.change(screen.getByTestId(`${testId}-time`), {target: {value: overrides.time ?? '19:30'}});
    fireEvent.change(screen.getByTestId(`${testId}-party`), {target: {value: overrides.party ?? '4'}});
    fireEvent.change(screen.getByTestId(`${testId}-name`), {target: {value: overrides.name ?? 'Jane'}});
    fireEvent.change(screen.getByTestId(`${testId}-email`), {target: {value: overrides.email ?? 'jane@example.com'}});
};

describe('ReservationWidget', () => {
    it('blocks submit on missing required fields', () => {
        const onSubmit = vi.fn();
        render(<ReservationWidget testId="rw" onSubmit={onSubmit} />);
        fireEvent.submit(screen.getByTestId('rw'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('rw-error')).toBeInTheDocument();
    });

    it('blocks bad email', () => {
        const onSubmit = vi.fn();
        render(<ReservationWidget testId="rw" onSubmit={onSubmit} />);
        fill('rw', {email: 'not-an-email'});
        fireEvent.submit(screen.getByTestId('rw'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('rw-error').textContent).toMatch(/email/i);
    });

    it('blocks partySize out of range', () => {
        const onSubmit = vi.fn();
        render(<ReservationWidget testId="rw" onSubmit={onSubmit} minPartySize={2} maxPartySize={6} />);
        fill('rw', {party: '10'});
        fireEvent.submit(screen.getByTestId('rw'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('rw-error').textContent).toMatch(/party size/i);
    });

    it('blocks date < minDate', () => {
        const onSubmit = vi.fn();
        render(<ReservationWidget testId="rw" onSubmit={onSubmit} minDate="2026-05-13" />);
        fill('rw', {date: '2026-05-01'});
        fireEvent.submit(screen.getByTestId('rw'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('rw-error').textContent).toMatch(/later date/i);
    });

    it('submits with valid payload', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ok: true});
        render(<ReservationWidget testId="rw" onSubmit={onSubmit} />);
        fill('rw');
        fireEvent.change(screen.getByTestId('rw-phone'), {target: {value: '+371...'}});
        fireEvent.submit(screen.getByTestId('rw'));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
        expect(onSubmit).toHaveBeenCalledWith({
            date: '2026-06-01',
            time: '19:30',
            partySize: 4,
            name: 'Jane',
            email: 'jane@example.com',
            phone: '+371...',
            notes: undefined,
        });
    });

    it('shows success state after submit', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ok: true});
        render(<ReservationWidget testId="rw" onSubmit={onSubmit} />);
        fill('rw');
        fireEvent.submit(screen.getByTestId('rw'));
        await waitFor(() => expect(screen.getByTestId('rw-success')).toBeInTheDocument());
        expect(screen.queryByTestId('rw-submit')).toBeNull();
    });

    it('surfaces error from onSubmit', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ok: false, error: 'service offline'});
        render(<ReservationWidget testId="rw" onSubmit={onSubmit} />);
        fill('rw');
        fireEvent.submit(screen.getByTestId('rw'));
        await waitFor(() => expect(screen.getByTestId('rw-error').textContent).toBe('service offline'));
    });
});
