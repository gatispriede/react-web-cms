import {describe, it, expect, vi} from 'vitest';
vi.mock('bcrypt');
vi.mock('next-auth/next', () => ({getServerSession: vi.fn()}));

import {
    guardMethods,
    AuthzError,
    ResourceForbiddenError,
    type GrantResolver,
    type ResourceGateExtractor,
} from '@services/features/Auth/authz';
import {userHasGrant, type Grant} from '@interfaces/IPermission';
import {postsFeature} from '@services/features/Posts/feature.manifest';

/**
 * Q10 — three-dimension grant evaluation tests.
 *
 * Contract:
 *   - Admin rank bypasses all dimension checks.
 *   - Otherwise the user must hold a matching grant for EACH declared
 *     dimension (intersection semantics).
 *   - A missing dimension value from the extractor is a hard deny.
 */

describe('userHasGrant — matrix coverage', () => {
    const grants: Grant[] = [
        {kind: 'feature', feature: 'Posts'},
        {kind: 'page', page: '/about'},
        {kind: 'locale', locale: 'lv'},
    ];

    it('matches exact feature grant', () => {
        expect(userHasGrant(grants, 'feature', 'Posts')).toBe(true);
    });
    it('matches exact page grant', () => {
        expect(userHasGrant(grants, 'page', '/about')).toBe(true);
    });
    it('matches exact locale grant', () => {
        expect(userHasGrant(grants, 'locale', 'lv')).toBe(true);
    });
    it('rejects wrong value within a known dimension', () => {
        expect(userHasGrant(grants, 'feature', 'Themes')).toBe(false);
        expect(userHasGrant(grants, 'page', '/pricing')).toBe(false);
        expect(userHasGrant(grants, 'locale', 'en')).toBe(false);
    });
    it('rejects missing dimension entirely', () => {
        expect(userHasGrant([], 'feature', 'Posts')).toBe(false);
        expect(userHasGrant(undefined, 'page', '/about')).toBe(false);
    });
});

describe('guardMethods — three-dimension grant gating (Q10)', () => {
    const target = {
        myMutation: vi.fn((args: any) => ({ok: true, args})),
    };
    const extractor: ResourceGateExtractor = (args: any) => ({
        dimensions: ['feature', 'page'] as const,
        values: {feature: 'Posts', page: args?.slug ?? ''},
    });
    const resourceGated = {myMutation: extractor};

    const grantResolverFor = (grants: Grant[]): GrantResolver =>
        async () => grants;

    it('admin bypasses dimension checks even with empty grants', async () => {
        const guarded = guardMethods(
            target, {role: 'admin', email: 'a@x'}, {myMutation: 'editor'}, {},
            resourceGated, undefined, grantResolverFor([]),
        );
        const res = await (guarded as any).myMutation({slug: '/about'});
        expect(res.ok).toBe(true);
    });

    it('denies an editor with only a feature grant when page is also required', async () => {
        const guarded = guardMethods(
            target, {role: 'editor', email: 'e@x'}, {myMutation: 'editor'}, {},
            resourceGated, undefined,
            grantResolverFor([{kind: 'feature', feature: 'Posts'}]),
        );
        await expect((guarded as any).myMutation({slug: '/about'}))
            .rejects.toBeInstanceOf(ResourceForbiddenError);
    });

    it('passes once the editor also holds the matching page grant', async () => {
        const guarded = guardMethods(
            target, {role: 'editor', email: 'e@x'}, {myMutation: 'editor'}, {},
            resourceGated, undefined,
            grantResolverFor([
                {kind: 'feature', feature: 'Posts'},
                {kind: 'page', page: '/about'},
            ]),
        );
        const res = await (guarded as any).myMutation({slug: '/about'});
        expect(res.ok).toBe(true);
    });

    it('denies when the page grant value does not match the declared resource', async () => {
        const guarded = guardMethods(
            target, {role: 'editor', email: 'e@x'}, {myMutation: 'editor'}, {},
            resourceGated, undefined,
            grantResolverFor([
                {kind: 'feature', feature: 'Posts'},
                {kind: 'page', page: '/pricing'},
            ]),
        );
        await expect((guarded as any).myMutation({slug: '/about'}))
            .rejects.toBeInstanceOf(AuthzError);
    });

    it('denies when extractor cannot derive a dimension value', async () => {
        const guarded = guardMethods(
            target, {role: 'editor', email: 'e@x'}, {myMutation: 'editor'}, {},
            resourceGated, undefined,
            grantResolverFor([
                {kind: 'feature', feature: 'Posts'},
                {kind: 'page', page: ''},
            ]),
        );
        await expect((guarded as any).myMutation({}))
            .rejects.toBeInstanceOf(ResourceForbiddenError);
    });
});

describe('Posts manifest wiring — end-to-end', () => {
    it('declares resourceGated dimensions on savePost / deletePost / setPostPublished', () => {
        const gated = postsFeature.authz?.resourceGated ?? {};
        expect(Object.keys(gated).sort()).toEqual(
            ['deletePost', 'savePost', 'setPostPublished'],
        );
        const out = (gated.savePost as ResourceGateExtractor)({post: {slug: '/blog/post-1'}});
        expect(out).toMatchObject({
            dimensions: ['feature', 'page'],
            values: {feature: 'Posts', page: '/blog/post-1'},
        });
    });

    it('Posts savePost: editor with {feature:Posts, page:/blog/post-1} passes; without page is denied', async () => {
        const target = {savePost: vi.fn(() => ({saved: true}))};
        const extractor = (postsFeature.authz?.resourceGated?.savePost as ResourceGateExtractor);
        const grants: Grant[] = [
            {kind: 'feature', feature: 'Posts'},
            {kind: 'page', page: '/blog/post-1'},
        ];
        const guarded = guardMethods(
            target, {role: 'editor', email: 'e@x'}, {savePost: 'editor'}, {},
            {savePost: extractor}, undefined, async () => grants,
        );
        const res = await (guarded as any).savePost({post: {slug: '/blog/post-1'}});
        expect(res.saved).toBe(true);

        const guardedNoPage = guardMethods(
            target, {role: 'editor', email: 'e@x'}, {savePost: 'editor'}, {},
            {savePost: extractor}, undefined,
            async () => [{kind: 'feature', feature: 'Posts'}],
        );
        await expect((guardedNoPage as any).savePost({post: {slug: '/blog/post-1'}}))
            .rejects.toBeInstanceOf(ResourceForbiddenError);
    });
});
