// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import CarReservationCta from './CarReservationCta';

const baseProps = {
    testId: 'res',
    priceFormatted: 'EUR 24,500',
    onReserve: vi.fn(),
};

describe('CarReservationCta', () => {
    it("state='available': reserve + contact visible", () => {
        render(<CarReservationCta {...baseProps} state="available" onContact={vi.fn()} forceVariant="desktop" />);
        expect(screen.getByTestId('res-reserve')).not.toBeDisabled();
        expect(screen.getByTestId('res-contact')).toBeInTheDocument();
        expect(screen.queryByTestId('res-status')).toBeNull();
    });

    it("state='reserved-by-other': reserve disabled; contact still visible", () => {
        render(<CarReservationCta {...baseProps} state="reserved-by-other" onContact={vi.fn()} forceVariant="desktop" />);
        expect(screen.getByTestId('res-reserve')).toBeDisabled();
        expect(screen.getByTestId('res-contact')).toBeInTheDocument();
    });

    it("state='reserved-by-you' WITH onCancel: cancel + status visible", () => {
        render(<CarReservationCta {...baseProps} state="reserved-by-you" onCancel={vi.fn()} forceVariant="desktop" />);
        expect(screen.getByTestId('res-cancel')).toBeInTheDocument();
        expect(screen.getByTestId('res-status')).toBeInTheDocument();
        expect(screen.queryByTestId('res-reserve')).toBeNull();
        expect(screen.queryByTestId('res-contact')).toBeNull();
    });

    it("state='reserved-by-you' WITHOUT onCancel: cancel hidden; status still visible", () => {
        render(<CarReservationCta {...baseProps} state="reserved-by-you" forceVariant="desktop" />);
        expect(screen.queryByTestId('res-cancel')).toBeNull();
        expect(screen.getByTestId('res-status')).toBeInTheDocument();
    });

    it("state='unavailable': status visible; reserve disabled", () => {
        render(<CarReservationCta {...baseProps} state="unavailable" forceVariant="desktop" />);
        expect(screen.getByTestId('res-status')).toBeInTheDocument();
        expect(screen.getByTestId('res-reserve')).toBeDisabled();
    });

    it('click reserve calls onReserve once', () => {
        const onReserve = vi.fn();
        render(<CarReservationCta {...baseProps} state="available" onReserve={onReserve} forceVariant="desktop" />);
        fireEvent.click(screen.getByTestId('res-reserve'));
        expect(onReserve).toHaveBeenCalledTimes(1);
    });

    it('click contact calls onContact once', () => {
        const onContact = vi.fn();
        render(<CarReservationCta {...baseProps} state="available" onContact={onContact} forceVariant="desktop" />);
        fireEvent.click(screen.getByTestId('res-contact'));
        expect(onContact).toHaveBeenCalledTimes(1);
    });

    it('data-state attribute matches the prop', () => {
        render(<CarReservationCta {...baseProps} state="unavailable" forceVariant="desktop" />);
        expect(screen.getByTestId('res').getAttribute('data-state')).toBe('unavailable');
    });

    it('forceVariant sets data-variant', () => {
        const {rerender} = render(<CarReservationCta {...baseProps} state="available" forceVariant="mobile" />);
        expect(screen.getByTestId('res').getAttribute('data-variant')).toBe('mobile');
        rerender(<CarReservationCta {...baseProps} state="available" forceVariant="desktop" />);
        expect(screen.getByTestId('res').getAttribute('data-variant')).toBe('desktop');
    });
});
