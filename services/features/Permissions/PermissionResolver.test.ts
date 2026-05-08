import {describe, it, expect} from 'vitest';
import {resolvePermissions} from './PermissionResolver';

describe('resolvePermissions', () => {
    it('resolves a page-scope grant using the page slug as resourceId', () => {
        const result = resolvePermissions({
            grants: [{id: 'g1', userId: 'u1', scope: 'page', resourceId: 'Home'}],
            pages: [{id: 'nav-1', page: 'Home'}],
        });
        expect(result[0]!.resourceLabel).toBe('Home');
    });

    it('falls back to navigation id when the resourceId is the nav doc id', () => {
        const result = resolvePermissions({
            grants: [{id: 'g1', userId: 'u1', scope: 'page', resourceId: 'nav-2'}],
            pages: [{id: 'nav-2', page: 'About'}],
        });
        expect(result[0]!.resourceLabel).toBe('About');
    });

    it('resolves module-scope grants to "module on <page>"', () => {
        const result = resolvePermissions({
            grants: [{id: 'g1', userId: 'u1', scope: 'module', resourceId: 'sec-1'}],
            pages: [{id: 'nav-1', page: 'Home'}],
            sections: [{id: 'sec-1', page: 'Home'}],
        });
        expect(result[0]!.resourceLabel).toBe('module on Home');
    });

    it('returns null label for element-scope grants and unresolved ids', () => {
        const result = resolvePermissions({
            grants: [
                {id: 'g1', userId: 'u1', scope: 'element', resourceId: 'translation.foo'},
                {id: 'g2', userId: 'u1', scope: 'page', resourceId: 'missing-page'},
                {id: 'g3', userId: 'u1', scope: 'module', resourceId: 'sec-orphan'},
            ],
            pages: [{id: 'nav-1', page: 'Home'}],
            sections: [],
        });
        expect(result[0]!.resourceLabel).toBeNull();
        expect(result[1]!.resourceLabel).toBeNull();
        expect(result[2]!.resourceLabel).toBeNull();
    });
});
