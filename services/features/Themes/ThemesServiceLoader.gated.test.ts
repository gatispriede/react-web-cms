import {describe, expect, it} from 'vitest';
import {themesFeature} from '@services/features/Themes/feature.manifest';
import type {ResourceGateExtractor} from '@services/features/Auth/authz';

describe('themesFeature — Q10 resourceGated', () => {
    it('declares feature-dimension gates on every theme mutation', () => {
        const gated = themesFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated).sort()).toEqual(
            ['deleteTheme', 'resetPreset', 'saveTheme', 'setActiveTheme'],
        );
        const out = (gated.saveTheme as ResourceGateExtractor)({});
        expect(out).toMatchObject({
            dimensions: ['feature'],
            values: {feature: 'Themes'},
        });
    });
});
