// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Hero from './Hero';
import {EItemType} from '@enums/EItemType';
import type {IHero} from './Hero.types';

// Identity translator — section tests assert on the raw English source, not
// on a localised variant. `translateOrKeep` returns the source when `t`
// returns a value equal to the key or empty; here we return the key verbatim
// so there's no double-translation surprise in assertions.
const t = ((k: string) => k) as any;

const fixture: IHero = {
    headline: 'Build *great* things',
    headlineSoft: 'with intention',
    subtitle: 'A tagline sub',
    tagline: 'Less is more',
    bgImage: 'images/hero.jpg',
    accent: '#ff00aa',
    eyebrow: 'DOSSIER № 001',
    titles: ['Engineer', 'Designer'],
    meta: [{label: 'Based', value: 'Sigulda'}],
    coords: [{label: 'LAT', value: '57.15'}],
    ctaPrimary: {label: 'Start', href: '/start', primary: true},
    ctaSecondary: {label: 'Docs', href: '/docs'},
};

describe('Hero render', () => {
    it('renders headline, subtitle, tagline + structural landmarks from a realistic fixture', () => {
        const {container} = render(
            <Hero
                item={{type: EItemType.Hero, content: JSON.stringify(fixture), style: 'editorial'}}
                t={t}
                tApp={t}
            />,
        );
        // h1 headline exists and contains the un-asterisked text
        const h1 = container.querySelector('h1.hero__headline');
        expect(h1).not.toBeNull();
        expect(h1!.textContent).toContain('Build');
        expect(h1!.textContent).toContain('great');
        expect(h1!.textContent).toContain('with intention');
        // accent run renders as <em class="em-accent">
        expect(container.querySelector('em.em-accent')?.textContent).toBe('great');
        // subtitle + tagline
        expect(container.querySelector('h2.hero__subtitle')).not.toBeNull();
        expect(container.querySelector('.hero__tagline')).not.toBeNull();
        // titles join
        expect(container.querySelector('.hero__titles')).not.toBeNull();
        expect(container.querySelectorAll('.hero__title-sep')).toHaveLength(1);
        // CTA row with both buttons
        const ctas = container.querySelectorAll('.hero__cta');
        expect(ctas).toHaveLength(2);
        expect(ctas[0].getAttribute('href')).toBe('/start');
        // meta dl + coords strip
        expect(container.querySelector('dl.hero__meta')).not.toBeNull();
        expect(container.querySelector('.hero__coords')).not.toBeNull();
        // bg image drives `is-fullbleed`
        expect(container.querySelector('.hero.is-fullbleed')).not.toBeNull();
        // Scrim is CSS-only now (`::before` pseudo + text-shadow) — the inline
        // `background-image` must NOT bake in the gradient any more, otherwise
        // themes can't tune scrim opacity via `--hero-scrim-opacity`. Guard:
        const bg = (container.querySelector('.hero') as HTMLElement).style.backgroundImage;
        expect(bg).toContain('url(');
        expect(bg).not.toContain('linear-gradient');
    });

    it('empty content: renders container but no optional sub-elements', () => {
        const empty: IHero = {headline: '', subtitle: '', tagline: '', bgImage: '', accent: ''};
        const {container} = render(
            <Hero
                item={{type: EItemType.Hero, content: JSON.stringify(empty)}}
                t={t}
                tApp={t}
            />,
        );
        expect(container.querySelector('.hero')).not.toBeNull();
        expect(container.querySelector('h1.hero__headline')).toBeNull();
        expect(container.querySelector('h2.hero__subtitle')).toBeNull();
        expect(container.querySelector('.hero__tagline')).toBeNull();
        expect(container.querySelector('.hero__cta-row')).toBeNull();
        expect(container.querySelector('dl.hero__meta')).toBeNull();
        // broken-image guard — nothing we'd render should have an empty src
        container.querySelectorAll('img').forEach((img) => {
            expect(img.getAttribute('src')).not.toBe('');
        });
    });
});
