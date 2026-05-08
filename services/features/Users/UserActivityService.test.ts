import {describe, it, expect} from 'vitest';
import {scanUserActivity} from './UserActivityService';

const NOW = '2026-05-08T12:00:00.000Z';

describe('scanUserActivity', () => {
    it('counts edits in the last 30 days and ignores older rows', () => {
        const result = scanUserActivity({
            users: [{email: 'gatis@example.com', lastLoginAt: '2026-05-01T00:00:00.000Z'}],
            auditRows: [
                {actor: {email: 'gatis@example.com'}, createdAt: '2026-05-07T00:00:00.000Z', diff: {after: {page: 'Home'}}},
                {actor: {email: 'gatis@example.com'}, createdAt: '2026-05-01T00:00:00.000Z', diff: {after: {page: 'About'}}},
                // Older than 30 days — should be excluded.
                {actor: {email: 'gatis@example.com'}, createdAt: '2026-01-01T00:00:00.000Z', diff: {after: {page: 'Old'}}},
            ],
            nowIso: NOW,
        });
        const gatis = result[0]!;
        expect(gatis.editsLast30d).toBe(2);
        expect(gatis.pagesEdited).toEqual(['About', 'Home']);
    });

    it('returns zero activity for users with no audit rows in the window', () => {
        const result = scanUserActivity({
            users: [{email: 'silent@example.com', lastLoginAt: null}],
            auditRows: [],
            nowIso: NOW,
        });
        expect(result[0]).toEqual({
            email: 'silent@example.com',
            lastLoginAt: null,
            editsLast30d: 0,
            pagesEdited: [],
        });
    });

    it('accepts both `{email}` and bare-string actor shapes', () => {
        const result = scanUserActivity({
            users: [{email: 'a@x.io'}, {email: 'b@x.io'}],
            auditRows: [
                {actor: 'a@x.io', createdAt: '2026-05-07T00:00:00.000Z'},
                {actor: {email: 'b@x.io'}, createdAt: '2026-05-07T00:00:00.000Z'},
            ],
            nowIso: NOW,
        });
        expect(result.find(r => r.email === 'a@x.io')!.editsLast30d).toBe(1);
        expect(result.find(r => r.email === 'b@x.io')!.editsLast30d).toBe(1);
    });

    it('extracts the page name from `diff.after.page` and `diff.before.page`', () => {
        const result = scanUserActivity({
            users: [{email: 'g@x.io'}],
            auditRows: [
                {actor: 'g@x.io', createdAt: '2026-05-07T00:00:00.000Z', diff: {after: {page: 'Home'}}},
                {actor: 'g@x.io', createdAt: '2026-05-07T00:00:00.000Z', diff: {before: {page: 'Contact'}}},
                // No identifiable page — should still count toward editsLast30d.
                {actor: 'g@x.io', createdAt: '2026-05-07T00:00:00.000Z', diff: {something: 'else'}},
            ],
            nowIso: NOW,
        });
        const g = result[0]!;
        expect(g.editsLast30d).toBe(3);
        expect(g.pagesEdited).toEqual(['Contact', 'Home']);
    });
});
