// @vitest-environment jsdom
import {describe, it, expect} from 'vitest';
import {GalleryContent} from './Gallery';
import {EItemType} from '@enums/EItemType';
import {ETextPosition} from '@enums/ETextPosition';

describe('GalleryContent normaliser', () => {
    it('reads pre-C18 item shape (src/imgWidth/imgHeight/href) into IImageRef + ILinkRef', () => {
        const legacy = JSON.stringify({
            disablePreview: false,
            items: [
                {src: 'api/a.jpg', alt: 'A', imgWidth: '200', imgHeight: '200', text: 'cap', textPosition: 'bottom', href: '/blog/a'},
            ],
        });
        const data = new GalleryContent(EItemType.Image, legacy).data;
        expect(data.items[0].image).toEqual({src: 'api/a.jpg', alt: 'A', width: '200', height: '200'});
        expect(data.items[0].link).toEqual({url: '/blog/a'});
        expect(data.items[0].text).toBe('cap');
    });

    it('round-trips new shape', () => {
        const cm = new GalleryContent(EItemType.Image, JSON.stringify({items: [], disablePreview: false}));
        cm.addItem({
            image: {src: 'api/x.jpg', width: 100, height: 100},
            preview: true,
            text: 'hi',
            textPosition: ETextPosition.Bottom,
            link: {url: 'https://example.com', label: 'Open'},
        });
        const json = cm.stringData;
        const data = new GalleryContent(EItemType.Image, json).data;
        expect(data.items[0].image).toEqual({src: 'api/x.jpg', width: 100, height: 100});
        expect(data.items[0].link).toEqual({url: 'https://example.com', label: 'Open'});
    });
});
