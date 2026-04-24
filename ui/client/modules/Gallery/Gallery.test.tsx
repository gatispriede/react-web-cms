// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Gallery from './Gallery';
import {EItemType} from '@enums/EItemType';
import {ETextPosition} from '@enums/ETextPosition';
import type {IGallery} from './Gallery.types';

const t = ((k: string) => k) as any;

const fixture: IGallery = {
    disablePreview: true,
    items: [
        {src: 'images/a.jpg', alt: 'A', height: 0, preview: true, text: 'Caption A', imgWidth: '', imgHeight: '', textPosition: ETextPosition.Bottom},
        {src: 'images/b.jpg', alt: 'B', height: 0, preview: true, text: '', imgWidth: '200', imgHeight: '200', textPosition: ETextPosition.Top},
    ],
};

describe('Gallery render', () => {
    it('renders one tile per item with a src prefixed by "/"', () => {
        const {container} = render(
            <Gallery
                item={{type: EItemType.Image, content: JSON.stringify(fixture), style: 'default'}}
                t={t}
                tApp={t}
            />,
        );
        const tiles = container.querySelectorAll('.gallery-wrapper-images .container');
        expect(tiles).toHaveLength(2);
        const imgs = container.querySelectorAll('img');
        expect(imgs.length).toBeGreaterThanOrEqual(2);
        imgs.forEach((img) => {
            const src = img.getAttribute('src') ?? '';
            // every rendered <img> points at the /public/... style path
            expect(src.startsWith('/')).toBe(true);
            expect(src).not.toBe('/');
        });
    });

    it('marquee style clones items with aria-hidden — originals + clones rendered', () => {
        const {container} = render(
            <Gallery
                item={{type: EItemType.Image, content: JSON.stringify(fixture), style: 'marquee'}}
                t={t}
                tApp={t}
            />,
        );
        const tiles = container.querySelectorAll('.gallery-wrapper-images .container');
        // 2 originals + 2 clones
        expect(tiles).toHaveLength(4);
        const hidden = container.querySelectorAll('.gallery-wrapper-images .container[aria-hidden="true"]');
        expect(hidden).toHaveLength(2);
    });

    it('empty items: renders gallery wrapper with zero tiles', () => {
        const empty: IGallery = {disablePreview: false, items: []};
        const {container} = render(
            <Gallery
                item={{type: EItemType.Image, content: JSON.stringify(empty), style: 'default'}}
                t={t}
                tApp={t}
            />,
        );
        expect(container.querySelector('.gallery-wrapper')).not.toBeNull();
        expect(container.querySelectorAll('.gallery-wrapper-images .container')).toHaveLength(0);
    });
});
