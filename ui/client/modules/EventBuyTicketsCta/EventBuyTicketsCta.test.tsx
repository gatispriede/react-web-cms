// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import EventBuyTicketsCta from './EventBuyTicketsCta';
import type {TicketTier} from './EventBuyTicketsCta.types';

const tiers: TicketTier[] = [
    {key: 'std', name: 'Standard', priceFormatted: 'EUR 49', href: 'https://buy.test/std'},
    {key: 'vip', name: 'VIP', priceFormatted: 'EUR 199', href: 'https://buy.test/vip', highlighted: true},
];

describe('EventBuyTicketsCta', () => {
    it('trigger button renders', () => {
        render(<EventBuyTicketsCta testId="bt" tiers={tiers} forceVariant="desktop" />);
        expect(screen.getByTestId('bt-trigger')).toBeInTheDocument();
        expect(screen.queryByTestId('bt-modal')).toBeNull();
    });

    it('click opens modal and tier list renders with hrefs', () => {
        render(<EventBuyTicketsCta testId="bt" tiers={tiers} forceVariant="desktop" />);
        fireEvent.click(screen.getByTestId('bt-trigger'));
        expect(screen.getByTestId('bt-modal')).toBeInTheDocument();
        expect(screen.getByTestId('bt-tier-std').getAttribute('href')).toBe('https://buy.test/std');
        expect(screen.getByTestId('bt-tier-vip').getAttribute('href')).toBe('https://buy.test/vip');
    });

    it('highlighted tier has accent class', () => {
        render(<EventBuyTicketsCta testId="bt" tiers={tiers} forceVariant="desktop" />);
        fireEvent.click(screen.getByTestId('bt-trigger'));
        expect(screen.getByTestId('bt-tier-vip').className).toMatch(/is-highlighted/);
        expect(screen.getByTestId('bt-tier-std').className).not.toMatch(/is-highlighted/);
    });

    it('escape closes the modal', () => {
        render(<EventBuyTicketsCta testId="bt" tiers={tiers} forceVariant="desktop" />);
        fireEvent.click(screen.getByTestId('bt-trigger'));
        fireEvent.keyDown(window, {key: 'Escape'});
        expect(screen.queryByTestId('bt-modal')).toBeNull();
    });

    it('tier click closes by default (keepOpenOnPurchase: false)', () => {
        render(<EventBuyTicketsCta testId="bt" tiers={tiers} forceVariant="desktop" />);
        fireEvent.click(screen.getByTestId('bt-trigger'));
        fireEvent.click(screen.getByTestId('bt-tier-std'));
        expect(screen.queryByTestId('bt-modal')).toBeNull();
    });

    it('keepOpenOnPurchase: true keeps modal open after tier click', () => {
        render(<EventBuyTicketsCta testId="bt" tiers={tiers} forceVariant="desktop" keepOpenOnPurchase />);
        fireEvent.click(screen.getByTestId('bt-trigger'));
        fireEvent.click(screen.getByTestId('bt-tier-std'));
        expect(screen.getByTestId('bt-modal')).toBeInTheDocument();
    });

    it('close button closes the modal', () => {
        render(<EventBuyTicketsCta testId="bt" tiers={tiers} forceVariant="desktop" />);
        fireEvent.click(screen.getByTestId('bt-trigger'));
        fireEvent.click(screen.getByTestId('bt-close'));
        expect(screen.queryByTestId('bt-modal')).toBeNull();
    });
});
