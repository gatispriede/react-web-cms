/**
 * agentLoop — unit tests for all four backends.
 *
 * Tests are fully offline: fetch is mocked and the Anthropic SDK is stubbed.
 * Each test verifies:
 *   1. The correct endpoint / base URL is called.
 *   2. The request body contains the right model, messages, and tool definitions.
 *   3. Tool calls in the response are dispatched and results fed back.
 *   4. `onEvent` emits the expected sequence of events.
 *   5. Missing API keys produce a clear `error` event instead of crashing.
 *
 * To run: npm test (vitest)
 */

import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ToolDefinition} from './agentTypes';

// ── Anthropic SDK stub ────────────────────────────────────────────────────────

const anthropicCreateMock = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
    default: class {
        messages = { create: anthropicCreateMock };
    },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal OpenAI-compatible response (no tool calls). */
function oaiTextResponse(text: string) {
    return {
        ok: true,
        status: 200,
        json: async () => ({
            choices: [{ message: { role: 'assistant', content: text, tool_calls: [] }, finish_reason: 'stop' }],
        }),
        text: async () => '',
    };
}

/** Minimal fetch-Response shape consumed by agentLoop's HTTP backends. */
interface FakeResponse {
    ok: boolean;
    status: number;
    json: () => Promise<unknown>;
    text: () => Promise<string>;
}

/** Build an OpenAI-compatible response that calls one tool, then stop on next turn. */
function oaiToolThenStopResponse(callId: string, name: string, args: Record<string, unknown>) {
    let call = 0;
    return vi.fn(async (): Promise<FakeResponse> => {
        call++;
        if (call === 1) {
            return {
                ok:     true,
                status: 200,
                json: async () => ({
                    choices: [{
                        message: {
                            role:       'assistant',
                            content:    null,
                            tool_calls: [{ id: callId, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
                        },
                        finish_reason: 'tool_calls',
                    }],
                }),
                text: async () => '',
            };
        }
        return { ok: true, status: 200, json: async () => ({ choices: [{ message: { role: 'assistant', content: 'Done!', tool_calls: [] }, finish_reason: 'stop' }] }), text: async () => '' };
    });
}

/** Minimal tool definitions for tests. */
const TEST_TOOLS: ToolDefinition[] = [{
    name:         'list_pages',
    description:  'List CMS pages',
    input_schema: { type: 'object' as const, properties: {} },
}];

/** No-op dispatch — records calls. */
function makeDispatch(result = '{"pages":[]}') {
    const calls: { name: string; input: Record<string, unknown> }[] = [];
    const dispatch = async (name: string, input: Record<string, unknown>) => {
        calls.push({ name, input });
        return result;
    };
    return { dispatch, calls };
}

/** Collect all events emitted by runAgentLoop. */
async function runAndCollect(task: string, env: Record<string, string>, modelOverride?: string) {
    // Splice env vars before importing (env is read at call-time for keys)
    const prev: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(env)) { prev[k] = process.env[k]; process.env[k] = v; }

    const events: unknown[] = [];
    const { dispatch } = makeDispatch();
    const { runAgentLoop } = await import('./agentLoop');
    await runAgentLoop({
        task,
        system:        'system prompt',
        tools:         TEST_TOOLS,
        dispatch,
        onEvent:       e => events.push(e),
        modelOverride,
    });

    for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    return events;
}

// ── Backend: Groq ─────────────────────────────────────────────────────────────

describe('Groq backend', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();   // re-import so env changes take effect
    });

    it('calls the Groq endpoint with the correct model and tool format', async () => {
        const fetchMock = vi.fn(async () => ({
            ok:     true,
            status: 200,
            json:   async () => ({ choices: [{ message: { role: 'assistant', content: 'ok', tool_calls: [] }, finish_reason: 'stop' }] }),
            text:   async () => '',
        }));
        vi.stubGlobal('fetch', fetchMock);

        const { runAgentLoop } = await import('./agentLoop');
        const events: unknown[] = [];
        const { dispatch } = makeDispatch();

        vi.stubEnv('GROQ_API_KEY', 'gsk_test_key');
        vi.stubEnv('ANTHROPIC_API_KEY', '');

        await runAgentLoop({ task: 'list pages', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: e => events.push(e), modelOverride: 'llama-3.3-70b-versatile' });

        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toContain('groq.com');
        expect(url).toContain('/chat/completions');

        const body = JSON.parse(init.body as string);
        expect(body.model).toBe('llama-3.3-70b-versatile');
        expect(body.tools[0].type).toBe('function');
        expect(body.tools[0].function.name).toBe('list_pages');
        expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer gsk_test_key');
    });

    it('dispatches tool calls and feeds results back', async () => {
        const fetchImpl = oaiToolThenStopResponse('call_1', 'list_pages', {});
        vi.stubGlobal('fetch', fetchImpl);
        vi.stubEnv('GROQ_API_KEY', 'gsk_test_key');
        vi.stubEnv('ANTHROPIC_API_KEY', '');

        const { runAgentLoop } = await import('./agentLoop');
        const events: unknown[] = [];
        const { dispatch, calls } = makeDispatch('{"pages":["Home"]}');

        await runAgentLoop({ task: 'what pages exist?', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: e => events.push(e), modelOverride: 'llama-3.3-70b-versatile' });

        expect(calls).toHaveLength(1);
        expect(calls[0].name).toBe('list_pages');

        const toolCallEvent = events.find((e: any) => e.type === 'tool_call') as any;
        expect(toolCallEvent?.name).toBe('list_pages');
        expect(toolCallEvent?.isWrite).toBe(false);

        const toolResultEvent = events.find((e: any) => e.type === 'tool_result') as any;
        expect(toolResultEvent?.result).toBe('{"pages":["Home"]}');
        expect(toolResultEvent?.isError).toBe(false);

        // Second fetch should include the tool result in messages
        const [, secondInit] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
        const secondBody = JSON.parse(secondInit.body as string);
        const toolMsg = secondBody.messages.find((m: any) => m.role === 'tool');
        expect(toolMsg?.content).toBe('{"pages":["Home"]}');
    });

    it('emits error event when GROQ_API_KEY is missing', async () => {
        vi.stubGlobal('fetch', vi.fn());
        vi.stubEnv('GROQ_API_KEY', '');
        vi.stubEnv('ANTHROPIC_API_KEY', '');
        vi.stubEnv('GEMINI_API_KEY', '');

        const { runAgentLoop } = await import('./agentLoop');
        const events: unknown[] = [];
        const { dispatch } = makeDispatch();

        await runAgentLoop({ task: 'test', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: e => events.push(e), modelOverride: 'llama-3.3-70b-versatile' });

        const errEvent = events.find((e: any) => e.type === 'error') as any;
        expect(errEvent).toBeDefined();
        expect(errEvent.message).toContain('GROQ_API_KEY');
    });
});

// ── Backend: Gemini ───────────────────────────────────────────────────────────

describe('Gemini backend', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('calls the Gemini OpenAI-compatible endpoint', async () => {
        const fetchMock = vi.fn(async () => ({
            ok:     true,
            status: 200,
            json:   async () => ({ choices: [{ message: { role: 'assistant', content: 'hi', tool_calls: [] }, finish_reason: 'stop' }] }),
            text:   async () => '',
        }));
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('GEMINI_API_KEY', 'AIzaTestKey');
        vi.stubEnv('ANTHROPIC_API_KEY', '');
        vi.stubEnv('GROQ_API_KEY', '');

        const { runAgentLoop } = await import('./agentLoop');
        const events: unknown[] = [];
        const { dispatch } = makeDispatch();

        await runAgentLoop({ task: 'hello', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: e => events.push(e), modelOverride: 'gemini-2.0-flash' });

        expect(fetchMock).toHaveBeenCalledOnce();
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toContain('generativelanguage.googleapis.com');
        expect(url).toContain('/chat/completions');

        const body = JSON.parse(init.body as string);
        expect(body.model).toBe('gemini-2.0-flash');
        expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer AIzaTestKey');
    });

    it('dispatches tool calls for Gemini', async () => {
        const fetchImpl = oaiToolThenStopResponse('gem_1', 'list_pages', {});
        vi.stubGlobal('fetch', fetchImpl);
        vi.stubEnv('GEMINI_API_KEY', 'AIzaTestKey');
        vi.stubEnv('ANTHROPIC_API_KEY', '');
        vi.stubEnv('GROQ_API_KEY', '');

        const { runAgentLoop } = await import('./agentLoop');
        const events: unknown[] = [];
        const { dispatch, calls } = makeDispatch('[]');

        await runAgentLoop({ task: 'list pages', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: e => events.push(e), modelOverride: 'gemini-2.0-flash' });

        expect(calls).toHaveLength(1);
        expect(events.some((e: any) => e.type === 'tool_call' && e.name === 'list_pages')).toBe(true);
        expect(events.some((e: any) => e.type === 'done')).toBe(true);
    });

    it('emits error event when GEMINI_API_KEY is missing', async () => {
        vi.stubGlobal('fetch', vi.fn());
        vi.stubEnv('GEMINI_API_KEY', '');
        vi.stubEnv('ANTHROPIC_API_KEY', '');
        vi.stubEnv('GROQ_API_KEY', '');

        const { runAgentLoop } = await import('./agentLoop');
        const events: unknown[] = [];
        const { dispatch } = makeDispatch();

        await runAgentLoop({ task: 'test', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: e => events.push(e), modelOverride: 'gemini-2.0-flash' });

        const errEvent = events.find((e: any) => e.type === 'error') as any;
        expect(errEvent?.message).toContain('GEMINI_API_KEY');
    });
});

// ── Backend: Ollama ───────────────────────────────────────────────────────────

describe('Ollama backend', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('calls the Ollama OpenAI-compatible endpoint', async () => {
        const fetchMock = vi.fn(async () => ({
            ok:     true,
            status: 200,
            json:   async () => ({ choices: [{ message: { role: 'assistant', content: 'hi', tool_calls: [] }, finish_reason: 'stop' }] }),
            text:   async () => '',
        }));
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('ANTHROPIC_API_KEY', '');
        vi.stubEnv('GROQ_API_KEY', '');
        vi.stubEnv('GEMINI_API_KEY', '');
        vi.stubEnv('OLLAMA_BASE_URL', 'http://localhost:11434');

        const { runAgentLoop } = await import('./agentLoop');
        const events: unknown[] = [];
        const { dispatch } = makeDispatch();

        await runAgentLoop({ task: 'hi', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: e => events.push(e), modelOverride: 'qwen2.5:14b' });

        expect(fetchMock).toHaveBeenCalledOnce();
        const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toContain('localhost:11434');
        expect(url).toContain('/v1/chat/completions');
    });
});

// ── Backend: Claude ───────────────────────────────────────────────────────────

describe('Claude backend', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
        anthropicCreateMock.mockReset();
    });

    it('uses the Anthropic SDK and emits text + done events', async () => {
        anthropicCreateMock.mockResolvedValue({
            content:     [{ type: 'text', text: 'Hello from Claude!' }],
            stop_reason: 'end_turn',
        });
        vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

        const { runAgentLoop } = await import('./agentLoop');
        const events: unknown[] = [];
        const { dispatch } = makeDispatch();

        await runAgentLoop({ task: 'say hi', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: e => events.push(e), modelOverride: 'claude-sonnet-4-5' });

        expect(anthropicCreateMock).toHaveBeenCalledOnce();
        const textEvent = events.find((e: any) => e.type === 'text') as any;
        expect(textEvent?.text).toBe('Hello from Claude!');
        expect(events.some((e: any) => e.type === 'done')).toBe(true);
    });

    it('dispatches Claude tool calls correctly', async () => {
        anthropicCreateMock
            .mockResolvedValueOnce({
                content:     [{ type: 'tool_use', id: 'tu_1', name: 'list_pages', input: {} }],
                stop_reason: 'tool_use',
            })
            .mockResolvedValueOnce({
                content:     [{ type: 'text', text: 'You have 3 pages.' }],
                stop_reason: 'end_turn',
            });

        vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test');

        const { runAgentLoop } = await import('./agentLoop');
        const events: unknown[] = [];
        const { dispatch, calls } = makeDispatch('["Home","About","Portfolio"]');

        await runAgentLoop({ task: 'how many pages?', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: e => events.push(e), modelOverride: 'claude-sonnet-4-5' });

        expect(calls).toHaveLength(1);
        expect(calls[0].name).toBe('list_pages');
        expect(events.some((e: any) => e.type === 'tool_call')).toBe(true);
        expect(events.some((e: any) => e.type === 'tool_result')).toBe(true);
        const textEvent = events.find((e: any) => e.type === 'text') as any;
        expect(textEvent?.text).toContain('3 pages');
    });
});

// ── Auto backend selection ────────────────────────────────────────────────────

describe('Backend auto-selection', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
        anthropicCreateMock.mockReset();
    });

    it('prefers Claude when ANTHROPIC_API_KEY is set', async () => {
        anthropicCreateMock.mockResolvedValue({
            content: [{ type: 'text', text: 'claude here' }], stop_reason: 'end_turn',
        });
        vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-real');
        vi.stubEnv('GROQ_API_KEY', 'gsk_also_set');

        const { runAgentLoop } = await import('./agentLoop');
        const { dispatch } = makeDispatch();
        await runAgentLoop({ task: 'hi', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: () => {} });

        expect(anthropicCreateMock).toHaveBeenCalled();
    });

    it('falls back to Groq when only GROQ_API_KEY is set', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true, status: 200,
            json: async () => ({ choices: [{ message: { role: 'assistant', content: 'groq here', tool_calls: [] }, finish_reason: 'stop' }] }),
            text: async () => '',
        }));
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('ANTHROPIC_API_KEY', '');
        vi.stubEnv('GROQ_API_KEY', 'gsk_only_this');
        vi.stubEnv('GEMINI_API_KEY', '');

        const { runAgentLoop } = await import('./agentLoop');
        const { dispatch } = makeDispatch();
        await runAgentLoop({ task: 'hi', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: () => {} });

        const [url] = fetchMock.mock.calls[0] as unknown as [string];
        expect(url).toContain('groq.com');
    });

    it('falls back to Gemini when only GEMINI_API_KEY is set', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true, status: 200,
            json: async () => ({ choices: [{ message: { role: 'assistant', content: 'gemini here', tool_calls: [] }, finish_reason: 'stop' }] }),
            text: async () => '',
        }));
        vi.stubGlobal('fetch', fetchMock);
        vi.stubEnv('ANTHROPIC_API_KEY', '');
        vi.stubEnv('GROQ_API_KEY', '');
        vi.stubEnv('GEMINI_API_KEY', 'AIzaGeminiKey');

        const { runAgentLoop } = await import('./agentLoop');
        const { dispatch } = makeDispatch();
        await runAgentLoop({ task: 'hi', system: 'sys', tools: TEST_TOOLS, dispatch, onEvent: () => {} });

        const [url] = fetchMock.mock.calls[0] as unknown as [string];
        expect(url).toContain('generativelanguage.googleapis.com');
    });
});
