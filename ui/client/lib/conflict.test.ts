import {describe, it, expect} from 'vitest';
import {ConflictError, isConflictError, isConflictPayload, parseMutationResponse} from './conflict';

describe('conflict primitives', () => {
    describe('isConflictPayload', () => {
        it('matches the shape mongoDBConnection.runMutation produces on ConflictError', () => {
            expect(isConflictPayload({conflict: true, currentVersion: 4, currentDoc: {id: 'x'}})).toBe(true);
        });

        it('rejects success payloads with no conflict key', () => {
            expect(isConflictPayload({saveTheme: {id: 'x', version: 4}})).toBe(false);
        });

        it('rejects malformed conflict shapes (missing currentVersion)', () => {
            expect(isConflictPayload({conflict: true})).toBe(false);
            expect(isConflictPayload({conflict: true, currentVersion: 'not-a-number'})).toBe(false);
        });

        it('rejects nullish input without throwing', () => {
            expect(isConflictPayload(null)).toBe(false);
            expect(isConflictPayload(undefined)).toBe(false);
            expect(isConflictPayload('')).toBe(false);
        });
    });

    describe('parseMutationResponse', () => {
        it('returns the parsed payload for non-conflict responses', () => {
            const out = parseMutationResponse<{saveTheme: {id: string; version: number}}>(
                JSON.stringify({saveTheme: {id: 'x', version: 4}}),
            );
            expect(out).toEqual({saveTheme: {id: 'x', version: 4}});
        });

        it('throws ConflictError on the conflict shape, carrying server state', () => {
            const raw = JSON.stringify({
                conflict: true,
                currentVersion: 7,
                currentDoc: {id: 'x', editedBy: 'alice@example.com'},
                message: 'Theme has been edited',
            });
            try {
                parseMutationResponse(raw);
                throw new Error('expected ConflictError to be thrown');
            } catch (err) {
                // The thrown value must satisfy both `instanceof Error` and the
                // structural conflict-bus check — editors rely on the latter.
                expect(isConflictError(err)).toBe(true);
                const ce = err as ConflictError<{id: string; editedBy?: string}>;
                expect(ce.currentVersion).toBe(7);
                expect(ce.currentDoc.editedBy).toBe('alice@example.com');
                expect(ce.message).toContain('Theme has been edited');
            }
        });

        it('returns the raw value when JSON parse fails (server returned plain text)', () => {
            const out = parseMutationResponse<string>('not-json');
            expect(out).toBe('not-json');
        });

        it('returns an empty object for empty/null input — matches the legacy "raw || {}" path', () => {
            expect(parseMutationResponse('')).toEqual({});
            expect(parseMutationResponse(null)).toEqual({});
            expect(parseMutationResponse(undefined)).toEqual({});
        });
    });
});
