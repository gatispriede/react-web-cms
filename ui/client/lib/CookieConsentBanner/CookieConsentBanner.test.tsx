// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi} from 'vitest';
import CookieConsentBanner from './CookieConsentBanner';
import type {ConsentCategory, ConsentDecision, CookieConsentBannerProps} from './CookieConsentBanner';

describe('CookieConsentBanner (forward-stub)', () => {
    it('renders nothing', () => {
        const {container} = render(
            <CookieConsentBanner
                policyVersion="v1"
                onDecide={() => {}}
                privacyHref="/privacy"
            />,
        );
        expect(container.firstChild).toBeNull();
        expect(screen.queryByTestId('cookie-consent-banner')).toBeNull();
    });

    it('module re-exports types and exports a callable component', () => {
        const probe: CookieConsentBannerProps = {
            policyVersion: 'v1',
            onDecide: () => {},
            privacyHref: '/privacy',
        };
        const cat: ConsentCategory = 'essential';
        const dec: ConsentDecision = {
            categories: {essential: true, analytics: false, marketing: false, personalisation: false},
            decidedAt: null,
            policyVersion: 'v1',
        };
        expect(probe.policyVersion).toBe('v1');
        expect(cat).toBe('essential');
        expect(dec.policyVersion).toBe('v1');
        expect(typeof CookieConsentBanner).toBe('function');
    });

    it('is callable with required props without runtime error', () => {
        const onDecide = vi.fn();
        expect(() => render(
            <CookieConsentBanner
                policyVersion="v1"
                onDecide={onDecide}
                privacyHref="/privacy"
            />,
        )).not.toThrow();
    });

    it('renders nothing even with initialDecision supplied', () => {
        const decision: ConsentDecision = {
            categories: {essential: true, analytics: true, marketing: false, personalisation: false},
            decidedAt: '2026-01-01T00:00:00Z',
            policyVersion: 'v1',
        };
        const {container} = render(
            <CookieConsentBanner
                policyVersion="v1"
                onDecide={() => {}}
                privacyHref="/privacy"
                cookieHref="/cookies"
                initialDecision={decision}
                headline="Cookies"
                body="We use cookies"
                acceptAllLabel="Accept"
                rejectAllLabel="Reject"
                customiseLabel="Customise"
            />,
        );
        expect(container.firstChild).toBeNull();
    });
});
