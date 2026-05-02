import {beforeEach, describe, expect, it} from 'vitest';
import {serverRestartFeature} from './feature.manifest';
import {ServerRestartService} from './ServerRestartService';
import {markRestartRequired, getRestartReasons, _resetRestartRegistryForTest} from '@services/infra/restartRequired';
import {bootId} from '@services/infra/bootId';

describe('serverRestartFeature manifest', () => {
    it('declares core-infrastructure id and displayName', () => {
        expect(serverRestartFeature.id).toBe('serverRestart');
        expect(serverRestartFeature.displayName).toBe('Server restart');
        expect(serverRestartFeature.coreInfrastructure).toBe(true);
    });

    it('services factory returns a `serverRestart` key holding a ServerRestartService', () => {
        const built = serverRestartFeature.services?.({db: {} as any, redis: {} as any, services: {}, reconnect: async () => {}});
        expect(built).toBeDefined();
        expect(built && Object.keys(built)).toEqual(['serverRestart']);
        expect(built?.serverRestart).toBeInstanceOf(ServerRestartService);
    });

    it('contributes the restart SDL fragment + admin authz', () => {
        expect(serverRestartFeature.schemaSDL).toContain('getRestartStatus');
        expect(serverRestartFeature.schemaSDL).toContain('requestServerRestart');
        expect(serverRestartFeature.authz?.queryRequirements?.getRestartStatus).toBe('admin');
        expect(serverRestartFeature.authz?.mutationRequirements?.requestServerRestart).toBe('admin');
        expect(serverRestartFeature.authz?.sessionInjected).toContain('requestServerRestart');
    });
});

describe('ServerRestartService', () => {
    let svc: ServerRestartService;

    beforeEach(() => {
        svc = new ServerRestartService();
        svc._resetRateLimitForTest();
        _resetRestartRegistryForTest();
    });

    it('health() returns bootId + uptime + supervised flag', () => {
        const h = svc.health();
        expect(h.status).toBe('ok');
        expect(h.bootId).toBe(bootId);
        expect(typeof h.uptimeMs).toBe('number');
    });

    it('status() includes any registered restart reasons', () => {
        markRestartRequired({source: 'feature-flags', key: 'mcp', detail: 'Restart required to load services and schema for "mcp"'});
        markRestartRequired({source: 'i18n', detail: 'Default locale changed'});
        const reasons = svc.status().reasons;
        expect(reasons.length).toBe(2);
        expect(reasons.find(r => r.source === 'feature-flags')?.key).toBe('mcp');
        expect(reasons.find(r => r.source === 'i18n')?.detail).toContain('locale');
    });

    it('requestRestart refuses when SERVER_SUPERVISED is unset', () => {
        const prev = process.env.SERVER_SUPERVISED;
        delete process.env.SERVER_SUPERVISED;
        try {
            const r = svc.requestRestart('admin@x.com');
            expect(r.ok).toBe(false);
            expect(r.error).toMatch(/supervisor/i);
        } finally {
            if (prev !== undefined) process.env.SERVER_SUPERVISED = prev;
        }
    });

    it('requestRestart refuses when SERVER_RESTART_ENABLED is false', () => {
        const prevEnabled = process.env.SERVER_RESTART_ENABLED;
        const prevSup = process.env.SERVER_SUPERVISED;
        process.env.SERVER_RESTART_ENABLED = 'false';
        process.env.SERVER_SUPERVISED = 'true';
        try {
            const r = svc.requestRestart('admin@x.com');
            expect(r.ok).toBe(false);
            expect(r.error).toMatch(/disabled/i);
        } finally {
            if (prevEnabled === undefined) delete process.env.SERVER_RESTART_ENABLED;
            else process.env.SERVER_RESTART_ENABLED = prevEnabled;
            if (prevSup === undefined) delete process.env.SERVER_SUPERVISED;
            else process.env.SERVER_SUPERVISED = prevSup;
        }
    });

    // Note: success path (ok === true) intentionally NOT exercised here —
    // the success path schedules `process.exit(0)` after a 500 ms delay
    // and would terminate the test runner. Integration test would mock
    // the apolloStop hook and assert the timer was scheduled.
});

describe('restartRequired registry', () => {
    beforeEach(() => _resetRestartRegistryForTest());

    it('idempotent on (source, key) — same reason twice = one row', () => {
        markRestartRequired({source: 'feature-flags', key: 'mcp', detail: 'restart for mcp'});
        markRestartRequired({source: 'feature-flags', key: 'mcp', detail: 'restart for mcp (again)'});
        expect(getRestartReasons().length).toBe(1);
    });

    it('different sources stack as separate rows', () => {
        markRestartRequired({source: 'feature-flags', key: 'mcp', detail: 'mcp'});
        markRestartRequired({source: 'i18n', detail: 'locale'});
        expect(getRestartReasons().length).toBe(2);
    });
});
