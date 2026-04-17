import {describe, it, expect} from 'vitest';
import {guardMethods, MUTATION_REQUIREMENTS, MUTATION_CAPABILITIES, AuthzError} from './authz';

const makeTarget = () => ({
    addUser: () => 'added',
    publishSnapshot: () => 'published',
    getSections: () => 'sections',
});

describe('guardMethods', () => {
    it('allows admin-gated methods for admin', () => {
        const guarded = guardMethods(makeTarget(), {role: 'admin'}, MUTATION_REQUIREMENTS);
        expect(guarded.addUser()).toBe('added');
    });

    it('blocks admin-gated methods for viewer', () => {
        const guarded = guardMethods(makeTarget(), {role: 'viewer'}, MUTATION_REQUIREMENTS);
        expect(() => guarded.addUser()).toThrowError(AuthzError);
    });

    it('allows unrestricted methods regardless of role', () => {
        const guarded = guardMethods(makeTarget(), {role: 'viewer'}, MUTATION_REQUIREMENTS);
        expect(guarded.getSections()).toBe('sections');
    });

    it('enforces capability predicate on publishSnapshot', () => {
        const editorNoPublish = guardMethods(makeTarget(), {role: 'editor', canPublishProduction: false}, MUTATION_REQUIREMENTS, MUTATION_CAPABILITIES);
        expect(() => editorNoPublish.publishSnapshot()).toThrowError(AuthzError);

        const editorCanPublish = guardMethods(makeTarget(), {role: 'editor', canPublishProduction: true}, MUTATION_REQUIREMENTS, MUTATION_CAPABILITIES);
        expect(editorCanPublish.publishSnapshot()).toBe('published');
    });
});
