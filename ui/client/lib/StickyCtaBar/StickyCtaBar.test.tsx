// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import StickyCtaBar from './StickyCtaBar';

describe('StickyCtaBar', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
    });

    it('renders nothing when ctas is empty', () => {
        const {container} = render(<StickyCtaBar ctas={[]} persistKey="empty" />);
        expect(container.firstChild).toBeNull();
        expect(screen.queryByTestId('sticky-cta-bar')).toBeNull();
    });

    it('caps at 3 CTAs when more provided (mobile)', () => {
        render(<StickyCtaBar
            forceVariant="mobile"
            persistKey="cap"
            ctas={[
                {label: 'A', onClick: () => {}},
                {label: 'B', onClick: () => {}},
                {label: 'C', onClick: () => {}},
                {label: 'D', onClick: () => {}},
                {label: 'E', onClick: () => {}},
            ]}
        />);
        expect(screen.getByTestId('sticky-cta-bar-cta-0')).toHaveTextContent('A');
        expect(screen.getByTestId('sticky-cta-bar-cta-2')).toHaveTextContent('C');
        expect(screen.queryByTestId('sticky-cta-bar-cta-3')).toBeNull();
    });

    it('renders <a> when href set, <button> when only onClick', () => {
        render(<StickyCtaBar
            forceVariant="mobile"
            persistKey="ab"
            ctas={[
                {label: 'Link', href: '/x'},
                {label: 'Action', onClick: () => {}},
            ]}
        />);
        expect(screen.getByTestId('sticky-cta-bar-cta-0').tagName).toBe('A');
        expect(screen.getByTestId('sticky-cta-bar-cta-0').getAttribute('href')).toBe('/x');
        expect(screen.getByTestId('sticky-cta-bar-cta-1').tagName).toBe('BUTTON');
    });

    it('desktop dismiss click sets sessionStorage flag and unmounts the bar', () => {
        render(<StickyCtaBar
            forceVariant="desktop"
            persistKey="vdp"
            ctas={[{label: 'Reserve', onClick: () => {}}]}
        />);
        expect(screen.getByTestId('sticky-cta-bar')).toBeInTheDocument();
        fireEvent.click(screen.getByTestId('sticky-cta-bar-dismiss'));
        expect(window.sessionStorage.getItem('stickycta.dismissed.vdp')).toBe('1');
        expect(screen.queryByTestId('sticky-cta-bar')).toBeNull();
    });

    it('pre-dismissed sessionStorage state hides bar on initial render', () => {
        window.sessionStorage.setItem('stickycta.dismissed.vdp2', '1');
        render(<StickyCtaBar
            forceVariant="desktop"
            persistKey="vdp2"
            ctas={[{label: 'Reserve', onClick: () => {}}]}
        />);
        expect(screen.queryByTestId('sticky-cta-bar')).toBeNull();
    });

    it('onClick fires for button CTAs', () => {
        const onClick = vi.fn();
        render(<StickyCtaBar
            forceVariant="mobile"
            persistKey="click"
            ctas={[{label: 'Call', onClick}]}
        />);
        fireEvent.click(screen.getByTestId('sticky-cta-bar-cta-0'));
        expect(onClick).toHaveBeenCalledOnce();
    });

    it('desktop variant shows only the first CTA when multiple configured', () => {
        render(<StickyCtaBar
            forceVariant="desktop"
            persistKey="multi"
            ctas={[
                {label: 'First', onClick: () => {}},
                {label: 'Second', onClick: () => {}},
            ]}
        />);
        expect(screen.getByTestId('sticky-cta-bar-cta-0')).toHaveTextContent('First');
        expect(screen.queryByTestId('sticky-cta-bar-cta-1')).toBeNull();
    });

    it('escape key dismisses desktop floating variant', () => {
        render(<StickyCtaBar
            forceVariant="desktop"
            persistKey="esc"
            ctas={[{label: 'Reserve', onClick: () => {}}]}
        />);
        expect(screen.getByTestId('sticky-cta-bar')).toBeInTheDocument();
        fireEvent.keyDown(window, {key: 'Escape'});
        expect(screen.queryByTestId('sticky-cta-bar')).toBeNull();
        expect(window.sessionStorage.getItem('stickycta.dismissed.esc')).toBe('1');
    });

    it('honours custom testId on a CTA', () => {
        render(<StickyCtaBar
            forceVariant="mobile"
            persistKey="custom"
            ctas={[{label: 'Call', onClick: () => {}, testId: 'vdp-call'}]}
        />);
        expect(screen.getByTestId('vdp-call')).toBeInTheDocument();
        expect(screen.queryByTestId('sticky-cta-bar-cta-0')).toBeNull();
    });
});
