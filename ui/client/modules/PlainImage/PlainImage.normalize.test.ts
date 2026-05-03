// @vitest-environment jsdom
import {describe, it, expect} from 'vitest';
import {PlainImageContent} from './PlainImage';
import {EItemType} from '@enums/EItemType';

describe('PlainImageContent normaliser', () => {
    it('reads pre-C18 flat shape into IImageRef', () => {
        const legacy = JSON.stringify({
            src: 'api/foo.jpg',
            alt: 'Foo',
            imgWidth: '480px',
            imgHeight: '320px',
            description: 'desc',
            useAsBackground: true,
        });
        const c = new PlainImageContent(EItemType.Image, legacy).data;
        expect(c.image.src).toBe('api/foo.jpg');
        expect(c.image.alt).toBe('Foo');
        expect(c.image.width).toBe('480px');
        expect(c.image.height).toBe('320px');
        expect(c.description).toBe('desc');
        expect(c.useAsBackground).toBe(true);
    });

    it('round-trips new IImageRef shape: data → stringData → re-parse equal', () => {
        const cm = new PlainImageContent(EItemType.Image, JSON.stringify({}));
        cm.data = {
            image: {src: 'api/bar.jpg', alt: 'Bar', width: 200, height: 100},
            description: '',
            useAsBackground: false,
            imageFixed: false,
            useGradiant: false,
            offsetX: 0,
            preview: false,
        };
        const json = cm.stringData;
        const reparsed = new PlainImageContent(EItemType.Image, json).data;
        expect(reparsed.image).toEqual({src: 'api/bar.jpg', alt: 'Bar', width: 200, height: 100});
    });

    it('emits new shape on save (no legacy src/imgWidth keys)', () => {
        const cm = new PlainImageContent(EItemType.Image, JSON.stringify({}));
        cm.setSrc('api/baz.jpg');
        cm.setImgWidth('100px');
        const obj = JSON.parse(cm.stringData);
        expect(obj.image).toEqual({src: 'api/baz.jpg', width: '100px'});
        expect(obj.src).toBeUndefined();
        expect(obj.imgWidth).toBeUndefined();
    });
});
