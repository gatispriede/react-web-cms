import {describe, it, expect} from 'vitest';
import {sanitizeHtml} from './sanitize';

describe('sanitizeHtml', () => {
    it('returns empty string for non-strings', () => {
        expect(sanitizeHtml(null as any)).toBe('');
        expect(sanitizeHtml(undefined as any)).toBe('');
        expect(sanitizeHtml(42 as any)).toBe('');
    });

    it('strips <script> tags', () => {
        expect(sanitizeHtml('<p>ok</p><script>alert(1)</script>')).not.toMatch(/script/i);
    });

    it('strips inline event handlers', () => {
        expect(sanitizeHtml('<a href="#" onclick="alert(1)">x</a>')).not.toMatch(/onclick/i);
    });

    it('blocks javascript: href', () => {
        expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toMatch(/javascript:/i);
    });

    it('leaves safe anchors alone', () => {
        const html = '<a href="https://example.com">safe</a>';
        expect(sanitizeHtml(html)).toBe(html);
    });
});
