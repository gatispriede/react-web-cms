import {describe, expect, it} from 'vitest';
import {navigationFeature} from '@services/features/Navigation/feature.manifest';
import type {ResourceGateExtractor} from '@services/features/Auth/authz';

describe('navigationFeature — Q10 resourceGated', () => {
    it('declares per-mutation gates with page dimension where the slug is in args', () => {
        const gated = navigationFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated).sort()).toEqual([
            'addUpdateNavigationItem',
            'addUpdateSectionItem',
            'createNavigation',
            'deleteNavigationItem',
            'removeSectionItem',
            'replaceUpdateNavigation',
            'setParent',
            'updateNavigation',
        ]);
    });

    it('uses {feature} only for cross-page or id-only mutations', () => {
        const gated = navigationFeature.authz?.resourceGated ?? {};
        const create = (gated.createNavigation as ResourceGateExtractor)({});
        expect(create).toMatchObject({dimensions: ['feature'], values: {feature: 'Navigation'}});

        const remove = (gated.removeSectionItem as ResourceGateExtractor)({id: 'abc'});
        expect(remove).toMatchObject({dimensions: ['feature'], values: {feature: 'Navigation'}});
    });

    it('uses {feature, page} for slug-bearing mutations', () => {
        const gated = navigationFeature.authz?.resourceGated ?? {};

        const add = (gated.addUpdateSectionItem as ResourceGateExtractor)({pageName: 'about'});
        expect(add).toMatchObject({dimensions: ['feature', 'page'], values: {feature: 'Navigation', page: 'about'}});

        const updNav = (gated.updateNavigation as ResourceGateExtractor)({page: 'home'});
        expect(updNav).toMatchObject({dimensions: ['feature', 'page'], values: {feature: 'Navigation', page: 'home'}});

        const replace = (gated.replaceUpdateNavigation as ResourceGateExtractor)({oldPageName: 'old'});
        expect(replace).toMatchObject({dimensions: ['feature', 'page'], values: {feature: 'Navigation', page: 'old'}});

        const del = (gated.deleteNavigationItem as ResourceGateExtractor)({pageName: 'gone'});
        expect(del).toMatchObject({dimensions: ['feature', 'page'], values: {feature: 'Navigation', page: 'gone'}});

        const addItem = (gated.addUpdateNavigationItem as ResourceGateExtractor)({pageName: 'contact'});
        expect(addItem).toMatchObject({dimensions: ['feature', 'page'], values: {feature: 'Navigation', page: 'contact'}});
    });

    it('F1 setParent — gates on {feature, page} where page = args.pageId', () => {
        const gated = navigationFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated)).toContain('setParent');

        const set = (gated.setParent as ResourceGateExtractor)({pageId: 'p-123', parentId: 'p-root'});
        expect(set).toMatchObject({
            dimensions: ['feature', 'page'],
            values: {feature: 'Navigation', page: 'p-123'},
        });

        const cleared = (gated.setParent as ResourceGateExtractor)({pageId: 'p-123', parentId: null});
        expect(cleared).toMatchObject({
            dimensions: ['feature', 'page'],
            values: {feature: 'Navigation', page: 'p-123'},
        });
    });
});
