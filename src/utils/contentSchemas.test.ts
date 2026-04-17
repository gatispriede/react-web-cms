import {describe, it, expect} from 'vitest';
import {validateItemContent, validateSectionInput} from './contentSchemas';
import EItemType from '../enums/EItemType';

describe('validateItemContent', () => {
    it('accepts a well-formed Text item', () => {
        expect(validateItemContent(EItemType.Text, JSON.stringify({value: 'hello'})).valid).toBe(true);
    });

    it('rejects a Text item whose value is not a string', () => {
        const result = validateItemContent(EItemType.Text, JSON.stringify({value: 123}));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/must be a string/);
    });

    it('rejects invalid JSON strings', () => {
        expect(validateItemContent(EItemType.Text, '{not-json').valid).toBe(false);
    });

    it('rejects oversized RichText', () => {
        const huge = 'x'.repeat(200_001);
        const result = validateItemContent(EItemType.RichText, JSON.stringify({value: huge}));
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/200KB/);
    });

    it('rejects image src that is not api/ or https', () => {
        const result = validateItemContent(EItemType.Image, JSON.stringify({imageLink: 'javascript:alert(1)'}));
        expect(result.valid).toBe(false);
    });

    it('accepts a local api/ image path', () => {
        expect(validateItemContent(EItemType.Image, JSON.stringify({imageLink: 'api/photo.jpg'})).valid).toBe(true);
    });

    it('passes through unknown item types', () => {
        expect(validateItemContent('CustomBlock', '{}').valid).toBe(true);
    });

    it('caps Gallery items at 200', () => {
        const items = Array.from({length: 201}, (_, i) => ({imageLink: `api/${i}.jpg`}));
        const result = validateItemContent(EItemType.Gallery, JSON.stringify({items}));
        expect(result.valid).toBe(false);
    });
});

describe('validateSectionInput', () => {
    it('requires a valid type and page', () => {
        expect(validateSectionInput({type: 1, page: 'home'}).valid).toBe(true);
        expect(validateSectionInput({type: 99, page: 'home'}).valid).toBe(false);
        expect(validateSectionInput({type: 1, page: 123 as any}).valid).toBe(false);
    });

    it('propagates item content errors with a path', () => {
        const section = {
            type: 1,
            page: 'home',
            content: [{type: EItemType.Image, content: JSON.stringify({imageLink: 'ftp://bad'})}],
        };
        const result = validateSectionInput(section);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/content\[0\]/);
    });
});
