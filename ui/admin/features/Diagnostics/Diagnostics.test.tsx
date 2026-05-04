// @vitest-environment jsdom
import React from 'react';
import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock the snapshot fetch + route probes so the render test runs offline.
const mockSnapshot = {
    build: {
        gitSha: 'abc1234',
        buildTimestamp: '2026-05-03T10:00:00Z',
        activeUpstream: 'app:80',
        bootId: 'boot-uuid-1',
        uptimeMs: 12345,
        nodeEnv: 'production',
        deployTier: 'prod',
    },
    features: [
        {id: 'alpha', displayName: 'Alpha', enabled: true, coreInfrastructure: true, mutationCount: 1, queryCount: 2, gatedMutationCount: 1, cascadeRuleCount: 0},
    ],
    storage: {mongo: {connected: true, replicaSet: true, transactionsSupported: true}, redis: {available: true, dbSize: null}, cacheVersions: {posts: 3}},
    trash: [{collection: 'Foo.trash', rowCount: 5, oldestDeletedAt: '2025-01-01T00:00:00Z', distinctTrashGroups: 2}],
    idempotency: {inFlight: 0, ttlSeconds: 300},
    authorization: {grantsByScope: {page: 4}, functionalRolesRegistered: 2, grantTotal: 4},
    generatedAt: '2026-05-03T12:00:00Z',
};

beforeEach(() => {
    (globalThis as any).fetch = vi.fn(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/graphql')) {
            return {
                ok: true,
                json: async () => ({data: {mongo: {getDiagnostics: JSON.stringify(mockSnapshot)}}}),
            } as any;
        }
        return {ok: true, status: 200, json: async () => ({})} as any;
    });
    (globalThis as any).performance = {now: () => 0};
});

import DiagnosticsPane from './Diagnostics';

describe('DiagnosticsPane', () => {
    it('renders all 7 sections after the snapshot loads', async () => {
        render(<DiagnosticsPane/>);
        // Wait a tick for the effect-driven refresh to resolve.
        await new Promise(r => setTimeout(r, 50));
        expect(screen.getByTestId('section-build')).toBeInTheDocument();
        expect(screen.getByTestId('section-routes')).toBeInTheDocument();
        expect(screen.getByTestId('section-features')).toBeInTheDocument();
        expect(screen.getByTestId('section-storage')).toBeInTheDocument();
        expect(screen.getByTestId('section-trash')).toBeInTheDocument();
        expect(screen.getByTestId('section-idempotency')).toBeInTheDocument();
        expect(screen.getByTestId('section-authz')).toBeInTheDocument();
    });

    it('exposes a Refresh button (no auto-refresh)', () => {
        render(<DiagnosticsPane/>);
        expect(screen.getByTestId('diagnostics-refresh')).toBeInTheDocument();
    });
});
