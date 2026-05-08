import {describe, expect, it} from 'vitest';
import {normalizeItemContent, normalizeSectionInput} from './normalizeSectionInput';

describe('normalizeItemContent — INFRA_TOPOLOGY', () => {
    it('renames svg → topologySvg when only legacy key is present', () => {
        const out = normalizeItemContent('INFRA_TOPOLOGY', {svg: '<svg/>'});
        expect(out.topologySvg).toBe('<svg/>');
    });

    it('renames caption → topologyCaption when only legacy key is present', () => {
        const out = normalizeItemContent('INFRA_TOPOLOGY', {caption: 'Edge layer'});
        expect(out.topologyCaption).toBe('Edge layer');
    });

    it('preserves canonical when both legacy and canonical are present (canonical wins)', () => {
        const out = normalizeItemContent('INFRA_TOPOLOGY', {
            svg: '<svg-legacy/>',
            topologySvg: '<svg-canonical/>',
        });
        expect(out.topologySvg).toBe('<svg-canonical/>');
    });

    it('leaves legacy keys in place (other consumers may read them)', () => {
        const out = normalizeItemContent('INFRA_TOPOLOGY', {svg: '<svg/>'});
        expect(out.svg).toBe('<svg/>');
        expect(out.topologySvg).toBe('<svg/>');
    });

    it('no-op for non-INFRA_TOPOLOGY items', () => {
        const input = {svg: '<svg/>'};
        const out = normalizeItemContent('HERO', input);
        expect(out).toBe(input); // same object reference — no rewrite
    });
});

describe('normalizeSectionInput', () => {
    it('walks items + normalizes INFRA_TOPOLOGY content', () => {
        const section = {
            id: 's1',
            type: 1,
            content: [
                {
                    type: 'INFRA_TOPOLOGY',
                    style: 'default',
                    content: JSON.stringify({svg: '<svg-old/>', caption: 'Edge'}),
                },
                {
                    type: 'HERO',
                    style: 'default',
                    content: JSON.stringify({headline: 'Hi'}),
                },
            ],
        } as any;
        const out = normalizeSectionInput(section);
        const topo = JSON.parse(out.content[0].content);
        expect(topo.topologySvg).toBe('<svg-old/>');
        expect(topo.topologyCaption).toBe('Edge');
        // Hero unchanged.
        expect(JSON.parse(out.content[1].content)).toEqual({headline: 'Hi'});
    });

    it('tolerates malformed JSON without rejecting the section', () => {
        const section = {
            id: 's1',
            type: 1,
            content: [
                {type: 'INFRA_TOPOLOGY', style: 'default', content: 'not json'},
                {type: 'HERO', style: 'default', content: JSON.stringify({headline: 'OK'})},
            ],
        } as any;
        const out = normalizeSectionInput(section);
        expect(out.content[0].content).toBe('not json');
        expect(JSON.parse(out.content[1].content)).toEqual({headline: 'OK'});
    });

    it('returns section unchanged when content is missing', () => {
        const section = {id: 's1', type: 1} as any;
        expect(normalizeSectionInput(section)).toEqual(section);
    });

    it('skips re-serialization for unmodified items (preserves item identity)', () => {
        const item = {
            type: 'HERO',
            style: 'default',
            content: JSON.stringify({headline: 'Hi'}),
        };
        const section = {id: 's1', type: 1, content: [item]} as any;
        const out = normalizeSectionInput(section);
        expect(out.content[0]).toBe(item); // same reference
    });
});
