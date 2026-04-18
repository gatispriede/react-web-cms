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

    it('injects session into args for SESSION_INJECTED_METHODS (publishSnapshot / rollbackToSnapshot)', () => {
        // Capture whatever the proxy delivers to the service.
        const captured: Record<string, any> = {};
        const target = {
            publishSnapshot: (args: any) => { captured.publish = args; return 'ok'; },
            rollbackToSnapshot: (args: any) => { captured.rollback = args; return 'ok'; },
            addUser: (args: any) => { captured.addUser = args; return 'ok'; },
        };
        const session = {role: 'admin' as const, email: 'alice@example.com', canPublishProduction: true};
        const guarded = guardMethods(target, session, MUTATION_REQUIREMENTS, MUTATION_CAPABILITIES);

        guarded.publishSnapshot({note: 'v1'});
        guarded.rollbackToSnapshot({id: 's1'});
        guarded.addUser({user: {email: 'x@y.com'}});

        // Publish + rollback should carry the session; regular methods should not.
        expect(captured.publish._session.email).toBe('alice@example.com');
        expect(captured.publish.note).toBe('v1');
        expect(captured.rollback._session.email).toBe('alice@example.com');
        expect(captured.rollback.id).toBe('s1');
        expect(captured.addUser._session).toBeUndefined();
    });
});
