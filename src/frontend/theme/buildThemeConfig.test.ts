import {describe, it, expect} from 'vitest';
import {buildThemeConfig} from './buildThemeConfig';

describe('buildThemeConfig', () => {
    it('returns the static theme when no tokens provided', () => {
        const cfg = buildThemeConfig(null);
        expect(cfg).toBeDefined();
        expect(cfg.token).toBeDefined();
    });

    it('strips empty/undefined values', () => {
        const cfg = buildThemeConfig({colorPrimary: '#ff0000', colorBgBase: '', colorTextBase: undefined as any});
        expect(cfg.token).toEqual({colorPrimary: '#ff0000'});
    });

    it('passes numeric tokens through', () => {
        const cfg = buildThemeConfig({borderRadius: 8, fontSize: 14});
        expect(cfg.token).toEqual({borderRadius: 8, fontSize: 14});
    });
});
