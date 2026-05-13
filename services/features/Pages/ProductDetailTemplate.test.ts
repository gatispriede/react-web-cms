/**
 * Phase 1.C — ProductDetailTemplate unit tests.
 */
import {describe, it, expect} from 'vitest';
import {buildProductDetailTemplate, fingerprintProductDetailTemplate} from './ProductDetailTemplate';

describe('ProductDetailTemplate', () => {
    it('emits hero + spec table locked, description + related unlocked', () => {
        const sections = buildProductDetailTemplate({productId: 'p-1', adapterId: 'x'});
        expect(sections[0].locked).toBe(true);   // hero
        expect(sections[1].locked).toBe(true);   // spec
        expect(sections[2].locked).toBeUndefined();    // description (unlocked)
        expect(sections[3].locked).toBeUndefined();    // related (unlocked)
    });

    it('appends reviews + contact form when requested', () => {
        const sections = buildProductDetailTemplate({
            productId: 'p-1', adapterId: 'x', includeReviews: true, includeContactForm: true,
        });
        expect(sections.length).toBe(6);
    });

    it('fingerprint is stable across re-runs for same shape', () => {
        const a = buildProductDetailTemplate({productId: 'p-1', adapterId: 'x'});
        const b = buildProductDetailTemplate({productId: 'p-2', adapterId: 'y'});
        expect(fingerprintProductDetailTemplate(a)).toBe(fingerprintProductDetailTemplate(b));
    });
});
