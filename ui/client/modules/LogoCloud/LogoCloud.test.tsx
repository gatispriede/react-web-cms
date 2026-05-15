// @vitest-environment jsdom
import React from 'react';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import LogoCloud from './LogoCloud';
import type {LogoEntry} from './LogoCloud.types';

function makeLogos(n: number): LogoEntry[] {
    return Array.from({length: n}, (_, i) => ({
        key: `l${i}`,
        name: `Brand ${i}`,
        logoUrl: `/logo-${i}.svg`,
    }));
}

describe('LogoCloud', () => {
    it('renders null when logos empty', () => {
        const {container} = render(<LogoCloud testId="lc" logos={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('caps at 10 logos', () => {
        const logos = makeLogos(15);
        render(<LogoCloud testId="lc" logos={logos} />);
        for (let i = 0; i < 10; i += 1) {
            expect(screen.getByTestId(`lc-logo-l${i}`)).toBeInTheDocument();
        }
        expect(screen.queryByTestId('lc-logo-l10')).toBeNull();
    });

    it('wraps img in <a> when href is supplied', () => {
        const logos: LogoEntry[] = [
            {key: 'a', name: 'A', logoUrl: '/a.svg', href: 'https://a.example'},
            {key: 'b', name: 'B', logoUrl: '/b.svg'},
        ];
        render(<LogoCloud testId="lc" logos={logos} />);
        const a = screen.getByTestId('lc-logo-a').querySelector('a');
        expect(a).not.toBeNull();
        expect(a?.getAttribute('href')).toBe('https://a.example');
        const b = screen.getByTestId('lc-logo-b').querySelector('a');
        expect(b).toBeNull();
    });

    it('uses name as alt and applies grayscale class', () => {
        const logos: LogoEntry[] = [{key: 'a', name: 'Acme', logoUrl: '/a.svg'}];
        render(<LogoCloud testId="lc" logos={logos} />);
        const img = screen.getByAltText('Acme');
        expect(img).toHaveClass('logo-cloud__img');
    });

    it('renders default headline', () => {
        render(<LogoCloud testId="lc" logos={makeLogos(2)} />);
        expect(screen.getByText('Trusted by teams at')).toBeInTheDocument();
    });
});
