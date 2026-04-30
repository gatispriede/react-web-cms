import {describe, it, expect, vi} from 'vitest';
vi.mock('bcrypt');
vi.mock('next-auth/next', () => ({getServerSession: vi.fn()}));
import {
    guardMethods,
    MUTATION_REQUIREMENTS,
    MUTATION_CAPABILITIES,
    CUSTOMER_MUTATION_REQUIREMENTS,
    CUSTOMER_QUERY_REQUIREMENTS,
    AuthzError,
} from '@services/features/Auth/authz';

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

    // ---------- customer / kind branching ----------

    const makeCustomerTarget = () => ({
        addUser: () => 'added',
        getMe: (args: any) => args,
        updateMyProfile: (args: any) => args,
        saveMyAddress: (args: any) => args,
        signUpCustomer: () => 'signed-up',
        getSections: () => 'sections',
    });

    it('rejects a customer session calling an admin mutation', () => {
        const guarded = guardMethods(
            makeCustomerTarget(),
            {kind: 'customer', role: 'viewer', email: 'c@x.com', customerId: 'c1'},
            MUTATION_REQUIREMENTS,
            MUTATION_CAPABILITIES,
        );
        expect(() => guarded.addUser()).toThrowError(AuthzError);
    });

    it('rejects an admin session calling a customer-only mutation', () => {
        const adminTarget = {...makeCustomerTarget()};
        const guarded = guardMethods(
            adminTarget,
            {kind: 'admin', role: 'admin', email: 'a@x.com'},
            {...MUTATION_REQUIREMENTS, ...CUSTOMER_MUTATION_REQUIREMENTS},
            MUTATION_CAPABILITIES,
        );
        expect(() => guarded.updateMyProfile({} as any)).toThrowError(AuthzError);
    });

    it('customer session calling getMe receives _session injection', () => {
        const guarded = guardMethods(
            makeCustomerTarget(),
            {kind: 'customer', role: 'viewer', email: 'c@x.com', customerId: 'c1'},
            CUSTOMER_QUERY_REQUIREMENTS,
        );
        const res = guarded.getMe({} as any) as any;
        expect(res._session.email).toBe('c@x.com');
        expect(res._session.customerId).toBe('c1');
    });

    it('anonymous session can call signUpCustomer but not customer mutations', () => {
        const guarded = guardMethods(
            makeCustomerTarget(),
            {kind: 'anonymous', role: 'viewer'},
            MUTATION_REQUIREMENTS,
            MUTATION_CAPABILITIES,
        );
        expect(guarded.signUpCustomer()).toBe('signed-up');
        const guardedC = guardMethods(
            makeCustomerTarget(),
            {kind: 'anonymous', role: 'viewer'},
            CUSTOMER_MUTATION_REQUIREMENTS,
        );
        expect(() => guardedC.updateMyProfile({} as any)).toThrowError(AuthzError);
    });

    it('customer saveMyAddress always receives _session — service uses it for IDOR guard', () => {
        // Capture what the service receives. The Proxy must always overlay
        // `_session.customerId`; the client can pass any `address.id` they
        // like, but the service uses the session id to scope the array.
        let captured: any = null;
        const target = {saveMyAddress: (args: any) => { captured = args; return 'ok'; }};
        const guarded = guardMethods(
            target,
            {kind: 'customer', role: 'viewer', email: 'c@x.com', customerId: 'real-customer'},
            CUSTOMER_MUTATION_REQUIREMENTS,
        );
        guarded.saveMyAddress({address: {id: 'someone-elses-address', line1: 'x'}} as any);
        expect(captured._session.customerId).toBe('real-customer');
        expect(captured.address.id).toBe('someone-elses-address');
    });
});
