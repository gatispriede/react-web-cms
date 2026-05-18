// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import OrderProgressTimeline from './OrderProgressTimeline';
import type {OrderProgressStep} from './OrderProgressTimeline.types';

const saleSteps: OrderProgressStep[] = [
    {key: 'ordered', label: 'Ordered', date: 'Mon 10:00', status: 'done'},
    {key: 'confirmed', label: 'Confirmed', date: 'Mon 11:30', status: 'done'},
    {key: 'scheduling', label: 'Scheduling', status: 'active'},
    {key: 'delivered', label: 'Delivered', status: 'pending'},
];

describe('OrderProgressTimeline', () => {
    it('renders exactly the steps passed in', () => {
        render(<OrderProgressTimeline testId="opt" steps={saleSteps} />);
        const items = screen.getByTestId('opt').querySelectorAll('li');
        expect(items).toHaveLength(4);
    });

    it('sets aria-current="step" on the active step only', () => {
        render(<OrderProgressTimeline testId="opt" steps={saleSteps} />);
        expect(screen.getByTestId('opt-step-scheduling').getAttribute('aria-current')).toBe('step');
        expect(screen.getByTestId('opt-step-ordered').getAttribute('aria-current')).toBeNull();
        expect(screen.getByTestId('opt-step-delivered').getAttribute('aria-current')).toBeNull();
    });

    it('reflects data-status for each step', () => {
        render(<OrderProgressTimeline testId="opt" steps={saleSteps} />);
        expect(screen.getByTestId('opt-step-ordered').getAttribute('data-status')).toBe('done');
        expect(screen.getByTestId('opt-step-scheduling').getAttribute('data-status')).toBe('active');
        expect(screen.getByTestId('opt-step-delivered').getAttribute('data-status')).toBe('pending');
    });

    it('renders the date sub-element only when step.date is set', () => {
        render(<OrderProgressTimeline testId="opt" steps={saleSteps} />);
        expect(screen.getByTestId('opt-step-ordered-date')).toHaveTextContent('Mon 10:00');
        expect(screen.queryByTestId('opt-step-scheduling-date')).toBeNull();
        expect(screen.queryByTestId('opt-step-delivered-date')).toBeNull();
    });

    it('defaults aria-label to "Order progress"', () => {
        render(<OrderProgressTimeline testId="opt" steps={saleSteps} />);
        expect(screen.getByTestId('opt').getAttribute('aria-label')).toBe('Order progress');
    });

    it('lets ariaLabel prop override the default', () => {
        render(<OrderProgressTimeline testId="opt" steps={saleSteps} ariaLabel="Reservation progress" />);
        expect(screen.getByTestId('opt').getAttribute('aria-label')).toBe('Reservation progress');
    });

    it('emits the per-step testid scheme', () => {
        render(<OrderProgressTimeline testId="my-progress" steps={saleSteps} />);
        expect(screen.getByTestId('my-progress')).toBeInTheDocument();
        expect(screen.getByTestId('my-progress-step-ordered')).toBeInTheDocument();
        expect(screen.getByTestId('my-progress-step-confirmed')).toBeInTheDocument();
        expect(screen.getByTestId('my-progress-step-scheduling')).toBeInTheDocument();
        expect(screen.getByTestId('my-progress-step-delivered')).toBeInTheDocument();
    });

    it('tags the container with data-variant', () => {
        render(<OrderProgressTimeline
            testId="opt"
            steps={saleSteps}
            variant="reservation-deposit"
        />);
        expect(screen.getByTestId('opt').getAttribute('data-variant')).toBe('reservation-deposit');
    });
});
