/**
 * MCP plugin SDK — first-class third-party tool registration.
 *
 * Today every MCP tool ships in-tree via per-feature `*_TOOLS` arrays
 * that `tools/index.ts` statically composes. That's right for built-in
 * surfaces but blocks the F8 vision of an open MCP ecosystem — a
 * customer who writes a Stripe-webhook adapter or a Zapier-bridge
 * shouldn't need to fork the CMS to expose its tools to an LLM agent.
 *
 * This module is the entry point for in-process plugins. A plugin is a
 * package (npm or local workspace) that exports a default object
 * conforming to `McpToolPlugin`; the host calls
 * `registerMcpToolPlugin(plugin)` once at boot (the registry validates
 * + dedups + name-spaces), then `buildToolRegistry()` merges every
 * registered plugin's tools alongside the built-ins.
 *
 * Out of scope for this scaffold (deferred to plugin-sdk v2):
 *   - Out-of-process plugins (separate node process / sandbox). The
 *     spec calls for `process.fork()` isolation; v1 trusts in-process.
 *   - Distribution + signing. A registry of vetted plugins comes later.
 *   - Hot-reload. Plugins must register before `buildToolRegistry()`
 *     runs; re-register-after-boot is not yet supported.
 *
 * Naming: every plugin declares a `namespace` slug (e.g. `stripe`,
 * `zapier`, `acme-co`) and the registry rewrites each tool's `name`
 * to `${namespace}.${name}` unless the tool already begins with that
 * prefix. Prevents collisions with built-in tools that own the bare
 * top-level namespace (`page.*`, `module.*`, `bundle.*`).
 *
 * See `services/features/Mcp/plugin/__tests__/registration.test.ts`
 * for the round-trip contract.
 */
import type {McpTool} from '../types';
import {log} from '@services/infra/logger';

/**
 * The shape a plugin package's default export must satisfy. Kept tiny
 * on purpose — adding to this surface is a versioned change because
 * every plugin re-exports against it.
 */
export interface McpToolPlugin {
    /**
     * Lowercase ASCII slug — `stripe`, `acme-co`, `zapier`. Must match
     * `[a-z][a-z0-9-]{1,31}`. Used as the dot-prefix for every tool's
     * registered name and as the audit-scope label so MCP audit rows
     * are filterable by plugin.
     */
    namespace: string;

    /** Semver of the plugin package. Recorded with each tool for debugability. */
    version: string;

    /** Human-readable label surfaced in the admin / audit UI. */
    displayName?: string;

    /** The tools this plugin contributes. Names get prefixed at register time. */
    tools: McpTool[];

    /**
     * Optional lifecycle hook fired once after the plugin is accepted by
     * the registry. Use it to register cleanup, warm caches, or assert
     * external configuration (`process.env.STRIPE_API_KEY` etc.). Errors
     * thrown here unregister the plugin's tools and surface in startup
     * logs — they do NOT crash the host.
     */
    onRegister?(ctx: {logger: typeof log}): void | Promise<void>;
}

/** Internal entry — the namespace-prefixed tools after registration. */
export interface RegisteredPlugin {
    namespace: string;
    version: string;
    displayName?: string;
    tools: McpTool[];
}

const NAMESPACE_RE = /^[a-z][a-z0-9-]{0,31}$/;

class PluginRegistry {
    private plugins: RegisteredPlugin[] = [];
    private namespaces = new Set<string>();

    register(plugin: McpToolPlugin): RegisteredPlugin {
        if (!NAMESPACE_RE.test(plugin.namespace)) {
            throw new Error(`MCP plugin namespace invalid: ${plugin.namespace} (expected /^[a-z][a-z0-9-]{0,31}$/)`);
        }
        if (this.namespaces.has(plugin.namespace)) {
            throw new Error(`MCP plugin namespace already registered: ${plugin.namespace}`);
        }
        if (plugin.tools.length === 0) {
            throw new Error(`MCP plugin ${plugin.namespace} contributes zero tools`);
        }

        const prefix = `${plugin.namespace}.`;
        const prefixed: McpTool[] = plugin.tools.map(t => {
            const name = t.name.startsWith(prefix) ? t.name : prefix + t.name;
            // Plugins inherit the namespace as their audit scope by
            // default — host audit dashboards can filter `mcp:stripe`
            // to see only plugin-originated calls without flipping per-
            // tool scope tags manually.
            const auditScope = t.auditScope ?? plugin.namespace;
            return {...t, name, auditScope};
        });
        const entry: RegisteredPlugin = {
            namespace: plugin.namespace,
            version: plugin.version,
            displayName: plugin.displayName,
            tools: prefixed,
        };
        this.plugins.push(entry);
        this.namespaces.add(plugin.namespace);

        // Fire the lifecycle hook; an exception here unregisters the
        // plugin so a broken onRegister doesn't leave half a tool set
        // registered. Errors surface in startup logs.
        if (plugin.onRegister) {
            try {
                const maybe = plugin.onRegister({logger: log});
                if (maybe && typeof (maybe as Promise<void>).then === 'function') {
                    void (maybe as Promise<void>).catch(err => {
                        this.unregister(plugin.namespace);
                        log.error(
                            {scope: 'mcp.plugin', namespace: plugin.namespace, err: String(err)},
                            'MCP plugin onRegister rejected — unregistered',
                        );
                    });
                }
            } catch (err) {
                this.unregister(plugin.namespace);
                throw err;
            }
        }
        log.info(
            {scope: 'mcp.plugin', namespace: plugin.namespace, version: plugin.version, tools: prefixed.length},
            'MCP plugin registered',
        );
        return entry;
    }

    unregister(namespace: string): boolean {
        const before = this.plugins.length;
        this.plugins = this.plugins.filter(p => p.namespace !== namespace);
        this.namespaces.delete(namespace);
        return this.plugins.length < before;
    }

    list(): RegisteredPlugin[] {
        return this.plugins.slice();
    }

    allTools(): McpTool[] {
        return this.plugins.flatMap(p => p.tools);
    }

    /** Test-only — clear all plugins. Not exported from the barrel. */
    _resetForTests(): void {
        this.plugins = [];
        this.namespaces.clear();
    }
}

const registry = new PluginRegistry();

/** Public entry — register a plugin. Throws on namespace conflict. */
export function registerMcpToolPlugin(plugin: McpToolPlugin): RegisteredPlugin {
    return registry.register(plugin);
}

/** Public entry — return a flat array of every plugin-contributed tool. */
export function getPluginTools(): McpTool[] {
    return registry.allTools();
}

/** Public entry — list registered plugins (admin / discovery surface). */
export function listRegisteredPlugins(): RegisteredPlugin[] {
    return registry.list();
}

/** Test-only — exported for the test file under `__tests__`. */
export function _resetPluginRegistryForTests(): void {
    registry._resetForTests();
}
