import {beforeEach, describe, expect, it} from 'vitest';
import type {McpTool} from '../../types';
import {
    _resetPluginRegistryForTests,
    getPluginTools,
    listRegisteredPlugins,
    registerMcpToolPlugin,
} from '../index';

const stubTool: McpTool = {
    name: 'ping',
    description: 'noop',
    scopes: ['read:content'],
    inputSchema: {type: 'object', properties: {}},
    handler: async () => ({content: [{type: 'text', text: 'pong'}]}),
};

describe('MCP plugin registry', () => {
    beforeEach(() => {
        _resetPluginRegistryForTests();
    });

    it('prefixes tool names with the plugin namespace', () => {
        registerMcpToolPlugin({
            namespace: 'stripe',
            version: '0.1.0',
            tools: [stubTool],
        });
        const tools = getPluginTools();
        expect(tools).toHaveLength(1);
        expect(tools[0].name).toBe('stripe.ping');
    });

    it('does not double-prefix names that already carry the namespace', () => {
        registerMcpToolPlugin({
            namespace: 'acme',
            version: '0.1.0',
            tools: [{...stubTool, name: 'acme.ping'}],
        });
        expect(getPluginTools()[0].name).toBe('acme.ping');
    });

    it('defaults the audit scope to the plugin namespace', () => {
        registerMcpToolPlugin({
            namespace: 'zapier',
            version: '0.1.0',
            tools: [stubTool],
        });
        expect(getPluginTools()[0].auditScope).toBe('zapier');
    });

    it('preserves an explicit audit scope when the tool sets one', () => {
        registerMcpToolPlugin({
            namespace: 'zapier',
            version: '0.1.0',
            tools: [{...stubTool, auditScope: 'webhook'}],
        });
        expect(getPluginTools()[0].auditScope).toBe('webhook');
    });

    it('rejects an invalid namespace', () => {
        expect(() => registerMcpToolPlugin({
            namespace: 'Bad Name!',
            version: '0.1.0',
            tools: [stubTool],
        })).toThrow(/namespace invalid/);
    });

    it('rejects duplicate namespace registration', () => {
        registerMcpToolPlugin({namespace: 'dup', version: '0.1.0', tools: [stubTool]});
        expect(() => registerMcpToolPlugin({
            namespace: 'dup',
            version: '0.2.0',
            tools: [stubTool],
        })).toThrow(/already registered/);
    });

    it('rejects an empty tool array', () => {
        expect(() => registerMcpToolPlugin({
            namespace: 'empty',
            version: '0.1.0',
            tools: [],
        })).toThrow(/zero tools/);
    });

    it('runs the onRegister lifecycle hook with a logger', () => {
        let captured: unknown = null;
        registerMcpToolPlugin({
            namespace: 'lc',
            version: '0.1.0',
            tools: [stubTool],
            onRegister: (ctx) => { captured = ctx.logger; },
        });
        expect(captured).toBeTruthy();
    });

    it('unregisters when onRegister throws synchronously', () => {
        expect(() => registerMcpToolPlugin({
            namespace: 'broken',
            version: '0.1.0',
            tools: [stubTool],
            onRegister: () => { throw new Error('boom'); },
        })).toThrow(/boom/);
        expect(listRegisteredPlugins()).toHaveLength(0);
    });

    it('lists registered plugins for the admin / discovery surface', () => {
        registerMcpToolPlugin({namespace: 'a', version: '1.0.0', tools: [stubTool]});
        registerMcpToolPlugin({namespace: 'b', version: '2.0.0', tools: [stubTool], displayName: 'B Plug'});
        const list = listRegisteredPlugins();
        expect(list.map(p => p.namespace).sort()).toEqual(['a', 'b']);
        expect(list.find(p => p.namespace === 'b')?.displayName).toBe('B Plug');
    });

    it('flattens tools across multiple plugins', () => {
        registerMcpToolPlugin({namespace: 'one', version: '1.0.0', tools: [stubTool]});
        registerMcpToolPlugin({namespace: 'two', version: '1.0.0', tools: [stubTool, {...stubTool, name: 'second'}]});
        const names = getPluginTools().map(t => t.name).sort();
        expect(names).toEqual(['one.ping', 'two.ping', 'two.second']);
    });
});
