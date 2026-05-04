import {describe, expect, it} from 'vitest';
import {diagnosticsFeature} from './feature.manifest';
import {DiagnosticsService} from './DiagnosticsService';

describe('diagnosticsFeature manifest', () => {
    it('declares stable id, displayName, core-infrastructure', () => {
        expect(diagnosticsFeature.id).toBe('diagnostics');
        expect(diagnosticsFeature.displayName).toBe('Diagnostics');
        expect(diagnosticsFeature.coreInfrastructure).toBe(true);
    });

    it('services factory returns a `diagnostics` key holding a DiagnosticsService', () => {
        const built = diagnosticsFeature.services?.({db: {} as any, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['diagnostics']);
        expect(built?.diagnostics).toBeInstanceOf(DiagnosticsService);
    });

    it('contributes the getDiagnostics SDL fragment + admin authz', () => {
        expect(diagnosticsFeature.schemaSDL).toContain('extend type QueryMongo');
        expect(diagnosticsFeature.schemaSDL).toContain('getDiagnostics: String!');
        expect(diagnosticsFeature.authz?.queryRequirements?.getDiagnostics).toBe('admin');
    });

    it('exposes no mutations and no resourceGated entries', () => {
        expect(diagnosticsFeature.authz?.mutationRequirements ?? {}).toEqual({});
        // resourceGated is per-mutation; with zero mutations it must be empty/absent
        const resourceGated = (diagnosticsFeature.authz as {resourceGated?: Record<string, unknown>} | undefined)?.resourceGated;
        expect(resourceGated ?? {}).toEqual({});
    });
});
