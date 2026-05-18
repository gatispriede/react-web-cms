// @vitest-environment jsdom
import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {describe, it, expect} from 'vitest';
import CarPhotoGallery from './CarPhotoGallery';

const photos = Array.from({length: 5}, (_, i) => ({
    url: `https://example.com/img-${i}.jpg`,
    alt: `Photo ${i}`,
}));

describe('CarPhotoGallery', () => {
    it('renders nothing when photos is empty', () => {
        const {container} = render(<CarPhotoGallery testId="gal" photos={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders hero at initialIndex (default 0)', () => {
        render(<CarPhotoGallery testId="gal" photos={photos} />);
        const hero = screen.getByTestId('gal-hero') as HTMLImageElement;
        expect(hero.src).toBe(photos[0].url);
    });

    it('honours initialIndex prop', () => {
        render(<CarPhotoGallery testId="gal" photos={photos} initialIndex={2} />);
        const hero = screen.getByTestId('gal-hero') as HTMLImageElement;
        expect(hero.src).toBe(photos[2].url);
    });

    it('prev hidden at index 0; next hidden at last', () => {
        render(<CarPhotoGallery testId="gal" photos={photos} initialIndex={0} />);
        expect(screen.queryByTestId('gal-prev')).toBeNull();
        expect(screen.getByTestId('gal-next')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('gal-thumb-4'));
        expect(screen.queryByTestId('gal-next')).toBeNull();
        expect(screen.getByTestId('gal-prev')).toBeInTheDocument();
    });

    it('next advances index', () => {
        render(<CarPhotoGallery testId="gal" photos={photos} />);
        fireEvent.click(screen.getByTestId('gal-next'));
        const hero = screen.getByTestId('gal-hero') as HTMLImageElement;
        expect(hero.src).toBe(photos[1].url);
    });

    it('thumb click sets hero to that image', () => {
        render(<CarPhotoGallery testId="gal" photos={photos} />);
        fireEvent.click(screen.getByTestId('gal-thumb-4'));
        const hero = screen.getByTestId('gal-hero') as HTMLImageElement;
        expect(hero.src).toBe(photos[4].url);
    });

    it('ArrowRight on focused container advances index', () => {
        render(<CarPhotoGallery testId="gal" photos={photos} />);
        const container = screen.getByTestId('gal');
        fireEvent.keyDown(container, {key: 'ArrowRight'});
        const hero = screen.getByTestId('gal-hero') as HTMLImageElement;
        expect(hero.src).toBe(photos[1].url);
    });

    it('count format is "${i+1} / ${total}"', () => {
        render(<CarPhotoGallery testId="gal" photos={photos} initialIndex={2} />);
        expect(screen.getByTestId('gal-count').textContent).toBe('3 / 5');
    });

    it('first 3 images eager, rest lazy', () => {
        render(<CarPhotoGallery testId="gal" photos={photos} />);
        const eagerThumbs = [0, 1, 2].map(i => screen.getByTestId(`gal-thumb-${i}`).querySelector('img'));
        eagerThumbs.forEach(img => expect(img?.getAttribute('loading')).toBe('eager'));
        const lazyThumbs = [3, 4].map(i => screen.getByTestId(`gal-thumb-${i}`).querySelector('img'));
        lazyThumbs.forEach(img => expect(img?.getAttribute('loading')).toBe('lazy'));
    });
});
