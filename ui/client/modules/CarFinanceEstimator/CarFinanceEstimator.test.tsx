// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import CarFinanceEstimator from './CarFinanceEstimator';

const fill = (testId: string, overrides: Partial<Record<string, string>> = {}) => {
    fireEvent.change(screen.getByTestId(`${testId}-name`), {target: {value: overrides.name ?? 'Jane'}});
    fireEvent.change(screen.getByTestId(`${testId}-email`), {target: {value: overrides.email ?? 'jane@example.com'}});
    fireEvent.change(screen.getByTestId(`${testId}-min`), {target: {value: overrides.min ?? '200'}});
    fireEvent.change(screen.getByTestId(`${testId}-max`), {target: {value: overrides.max ?? '400'}});
};

describe('CarFinanceEstimator', () => {
    it('renders form with headline + body + submit', () => {
        render(<CarFinanceEstimator testId="fin" productId="car-1" onSubmit={vi.fn()} />);
        expect(screen.getByTestId('fin')).toBeInTheDocument();
        expect(screen.getByTestId('fin-submit')).toHaveTextContent('Request a quote');
    });

    it('blocks submit on missing required fields', () => {
        const onSubmit = vi.fn();
        render(<CarFinanceEstimator testId="fin" productId="car-1" onSubmit={onSubmit} />);
        fireEvent.submit(screen.getByTestId('fin'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('fin-error')).toBeInTheDocument();
    });

    it('blocks invalid email format', () => {
        const onSubmit = vi.fn();
        render(<CarFinanceEstimator testId="fin" productId="car-1" onSubmit={onSubmit} />);
        fill('fin', {email: 'not-an-email'});
        fireEvent.submit(screen.getByTestId('fin'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('fin-error').textContent).toMatch(/email/i);
    });

    it('blocks when min > max', () => {
        const onSubmit = vi.fn();
        render(<CarFinanceEstimator testId="fin" productId="car-1" onSubmit={onSubmit} />);
        fill('fin', {min: '500', max: '200'});
        fireEvent.submit(screen.getByTestId('fin'));
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByTestId('fin-error').textContent).toMatch(/minimum/i);
    });

    it('submits with the expected payload on valid input', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ok: true});
        render(<CarFinanceEstimator testId="fin" productId="car-1" onSubmit={onSubmit} />);
        fill('fin');
        fireEvent.submit(screen.getByTestId('fin'));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
        expect(onSubmit).toHaveBeenCalledWith({
            name: 'Jane',
            email: 'jane@example.com',
            phone: undefined,
            minMonthly: 200,
            maxMonthly: 400,
            notes: undefined,
        });
    });

    it('shows success state after onSubmit resolves {ok: true}', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ok: true});
        render(<CarFinanceEstimator testId="fin" productId="car-1" onSubmit={onSubmit} />);
        fill('fin');
        fireEvent.submit(screen.getByTestId('fin'));
        await waitFor(() => expect(screen.getByTestId('fin-success')).toBeInTheDocument());
        expect(screen.queryByTestId('fin-submit')).toBeNull();
    });

    it('surfaces error after onSubmit resolves {ok: false}', async () => {
        const onSubmit = vi.fn().mockResolvedValue({ok: false, error: 'service offline'});
        render(<CarFinanceEstimator testId="fin" productId="car-1" onSubmit={onSubmit} />);
        fill('fin');
        fireEvent.submit(screen.getByTestId('fin'));
        await waitFor(() => expect(screen.getByTestId('fin-error').textContent).toBe('service offline'));
    });
});
