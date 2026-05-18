/**
 * Phase 1.C — CategoryTemplate unit tests.
 */
import {describe, it, expect} from 'vitest';
import {buildCategoryTemplate, fingerprintCategoryTemplate} from './CategoryTemplate';

describe('CategoryTemplate', () => {
    it('emits locked structural sections + an unlocked optional newsletter', () => {
        const sections = buildCategoryTemplate({
            slug: 'cars',
            label: 'Cars',
            adapterId: 'ss-com-cars',
            filter: {category: 'cars'},
            withNewsletter: true,
        });
        // Hero / breadcrumb / filterbar / grid / pagination locked.
        const lockedCount = sections.filter(s => s.locked).length;
        expect(lockedCount).toBe(5);
        // Newsletter unlocked.
        const newsletter = sections[sections.length - 1];
        expect(newsletter.locked).toBeUndefined();
    });

    it('omits newsletter when withNewsletter is false', () => {
        const sections = buildCategoryTemplate({
            slug: 'cars', label: 'Cars', adapterId: 'a', filter: {},
        });
        expect(sections.length).toBe(5);
        expect(sections.every(s => s.locked)).toBe(true);
    });

    it('produces a stable fingerprint over multiple builds with same shape', () => {
        const a = buildCategoryTemplate({slug: 'cars', label: 'Cars', adapterId: 'x', filter: {}});
        const b = buildCategoryTemplate({slug: 'electronics', label: 'Electronics', adapterId: 'y', filter: {}});
        // Shape is the same — content payload differs but fingerprint
        // (types + locked flags) matches.
        expect(fingerprintCategoryTemplate(a)).toBe(fingerprintCategoryTemplate(b));
    });

    it('fingerprint changes when sections are added', () => {
        const base = buildCategoryTemplate({slug: 'a', label: 'A', adapterId: 'x', filter: {}});
        const withCta = buildCategoryTemplate({slug: 'b', label: 'B', adapterId: 'x', filter: {}, withNewsletter: true});
        expect(fingerprintCategoryTemplate(base)).not.toBe(fingerprintCategoryTemplate(withCta));
    });
});
