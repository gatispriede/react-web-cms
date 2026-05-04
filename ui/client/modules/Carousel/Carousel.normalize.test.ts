// @vitest-environment jsdom
import {describe, it, expect} from 'vitest';
import {CarouselContent} from './Carousel';
import {EItemType} from '@enums/EItemType';

describe('CarouselContent normaliser', () => {
    it('reads pre-C18 carousel item shape into IImageRef', () => {
        const legacy = JSON.stringify({
            autoplay: true,
            autoplaySpeed: 5000,
            items: [
                {src: 'api/a.jpg', alt: 'A', imgWidth: '300', imgHeight: '200', text: 'cap'},
            ],
        });
        const data = new CarouselContent(EItemType.Image, legacy).data;
        expect(data.autoplay).toBe(true);
        expect(data.autoplaySpeed).toBe(5000);
        expect(data.items[0].image).toEqual({src: 'api/a.jpg', alt: 'A', width: '300', height: '200'});
    });

    it('round-trips new shape', () => {
        const cm = new CarouselContent(EItemType.Image, JSON.stringify({}));
        cm.addItem({
            image: {src: 'api/y.jpg'},
            preview: true,
            text: '',
            textPosition: 'bottom' as any,
        });
        const data = new CarouselContent(EItemType.Image, cm.stringData).data;
        expect(data.items[0].image.src).toBe('api/y.jpg');
    });
});
