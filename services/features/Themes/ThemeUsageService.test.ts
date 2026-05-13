import {describe, it, expect} from 'vitest';
import {scanThemeUsage} from './ThemeUsageService';

// Fixture names mirror the first-class theme set after the 2026-05-13
// colour-only-presets cleanup. `scanThemeUsage` doesn't validate names
// against a registry — they're opaque labels here — so updating the
// strings is cosmetic but keeps the test readable.

describe('scanThemeUsage', () => {
    it('marks the active theme via the activeId field', () => {
        const result = scanThemeUsage({
            themes: [
                {id: 't1', name: 'Editorial'},
                {id: 't2', name: 'Commerce'},
            ],
            activeId: 't1',
            publishHistoryThemeIds: [],
        });
        expect(result.find(r => r.id === 't1')!.isActive).toBe(true);
        expect(result.find(r => r.id === 't2')!.isActive).toBe(false);
    });

    it('flags themes that appear in publish history even when not currently active', () => {
        const result = scanThemeUsage({
            themes: [
                {id: 't1', name: 'Editorial'},
                {id: 't2', name: 'Commerce'},
            ],
            activeId: 't1',
            publishHistoryThemeIds: ['t2', 't1', 't2'],
        });
        expect(result.find(r => r.id === 't2')!.inPublishHistory).toBe(true);
    });

    it('marks themes without active or history as completely unused', () => {
        const result = scanThemeUsage({
            themes: [{id: 'orphan', name: 'OrphanTheme'}],
            activeId: 't-other',
            publishHistoryThemeIds: ['t-other'],
        });
        const orphan = result[0]!;
        expect(orphan.isActive).toBe(false);
        expect(orphan.inPublishHistory).toBe(false);
    });

    it('handles a null activeId (no theme set yet)', () => {
        const result = scanThemeUsage({
            themes: [{id: 't1', name: 'Editorial'}],
            activeId: null,
            publishHistoryThemeIds: [],
        });
        expect(result[0]!.isActive).toBe(false);
    });

    it('returns an empty array when no themes are passed', () => {
        const result = scanThemeUsage({themes: [], activeId: 't1', publishHistoryThemeIds: ['t1']});
        expect(result).toEqual([]);
    });
});
