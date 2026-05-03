/**
 * Inline CMS agent loop — runs fully inside the Next.js process.
 *
 * Supports four backends:
 *   claude  — Anthropic API (default when ANTHROPIC_API_KEY is set)
 *   groq    — Groq cloud, free tier — llama-3.3-70b-versatile  (GROQ_API_KEY)
 *   gemini  — Google Gemini, free tier — gemini-2.0-flash       (GEMINI_API_KEY)
 *   ollama  — local Ollama instance                              (AGENT_BACKEND=ollama)
 *
 * Auto-selection order (when no model is pinned): claude → groq → gemini → ollama
 * Model name pins the backend automatically:
 *   claude-*          → claude
 *   llama-* / mixtral → groq
 *   gemini-*          → gemini
 *   qwen*             → ollama
 */

import Anthropic from '@anthropic-ai/sdk';
import type {ToolDefinition, ToolDispatch, OnEvent} from './agentTypes';

const MAX_TURNS = 30;

// ── Backend selection ─────────────────────────────────────────────────────────

type Backend = 'claude' | 'groq' | 'gemini' | 'ollama';

const GROQ_MODEL_IDS   = new Set(['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it']);

function resolveBackend(modelOverride?: string): Backend {
    if (modelOverride) {
        if (modelOverride.startsWith('claude-'))  return 'claude';
        if (GROQ_MODEL_IDS.has(modelOverride))    return 'groq';
        if (modelOverride.startsWith('gemini-'))  return 'gemini';
        if (modelOverride.startsWith('qwen'))     return 'ollama';
    }
    const explicit = (process.env.AGENT_BACKEND ?? '').toLowerCase() as Backend | '';
    if (['claude', 'groq', 'gemini', 'ollama'].includes(explicit)) return explicit as Backend;

    // Auto — prefer paid/best first
    if ((process.env.ANTHROPIC_API_KEY ?? '').startsWith('sk-'))   return 'claude';
    if ((process.env.GROQ_API_KEY      ?? '').startsWith('gsk_'))  return 'groq';
    if ((process.env.GEMINI_API_KEY    ?? '').startsWith('AIza'))  return 'gemini';
    return 'ollama';
}

// ── Claude client ─────────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
    if (!_anthropic) {
        const key = process.env.ANTHROPIC_API_KEY ?? '';
        if (!key.startsWith('sk-')) throw new Error(
            'ANTHROPIC_API_KEY not set. Use AGENT_BACKEND=groq, gemini, or ollama.',
        );
        _anthropic = new Anthropic({ apiKey: key });
    }
    return _anthropic;
}

// ── Shared OpenAI-compatible chat (Groq, Gemini /v1beta/openai, Ollama /v1) ──

interface OAIMessage {
    role:           string;
    content:        string | null;
    tool_calls?:    OAIToolCall[];
    tool_call_id?:  string;
}
interface OAIToolCall {
    id:       string;
    type:     'function';
    function: { name: string; arguments: string };
}
interface OAIResponse {
    choices: Array<{
        message:       OAIMessage;
        finish_reason: string;
    }>;
}

async function openAICompatChat(opts: {
    baseUrl:  string;
    apiKey:   string;
    model:    string;
    system:   string;
    messages: OAIMessage[];
    tools:    ToolDefinition[];
    timeout:  number;
}): Promise<{ text: string; calls: Array<{ id: string; name: string; input: Record<string, unknown> }> }> {
    const { baseUrl, apiKey, model, system, messages, tools, timeout } = opts;

    const res = await fetch(`${baseUrl}/chat/completions`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: system }, ...messages],
            tools: tools.map(t => ({
                type:     'function',
                function: { name: t.name, description: t.description, parameters: t.input_schema },
            })),
            // parallel_tool_calls: false is required for llama-3.x models on Groq.
            // Without it the model may attempt simultaneous calls which Groq rejects with HTTP 400.
            parallel_tool_calls: false,
            temperature: 0.3,
        }),
        signal: AbortSignal.timeout(timeout),
    });

    if (!res.ok) {
        const raw = await res.text();
        console.error('[agentLoop] API error raw body:', raw);  // ← temporary debug
        // Extract the human-readable message from Google / Groq / OpenAI error bodies
        let detail = raw;
        try {
            const parsed = JSON.parse(raw);
            // Google: { error: { message: '...' } }  or  [{ error: { message } }]
            const errObj = parsed?.error ?? parsed?.[0]?.error ?? parsed;
            const msg    = errObj?.message ?? errObj?.error?.message ?? null;
            if (msg) {
                const status  = errObj?.status ?? '';
                const retry   = errObj?.details?.find?.((d: any) => d?.retryDelay)?.retryDelay ?? '';
                // Keep only the first sentence — strip verbose metric bullet points (Gemini error format)
                const firstLine = String(msg).split('\n')[0].split('. ')[0];
                detail = `${firstLine}${retry ? ` (retry in ${retry})` : ''}${status ? ` [${status}]` : ''}`;
            }
        } catch { /* keep raw */ }
        throw new Error(`HTTP ${res.status}: ${detail}`);
    }
    const body = await res.json() as OAIResponse;
    const msg  = body.choices[0]?.message;

    const calls = (msg?.tool_calls ?? []).map(c => {
        let input: Record<string, unknown> = {};
        try { input = JSON.parse(c.function.arguments); } catch { /* ignore */ }
        return { id: c.id, name: c.function.name, input };
    });

    return { text: msg?.content ?? '', calls };
}

// ── Backend configs ───────────────────────────────────────────────────────────

const BACKENDS = {
    groq: {
        baseUrl:      'https://api.groq.com/openai/v1',
        defaultModel: 'llama-3.3-70b-versatile',
        timeout:      120_000,
        keyEnv:       'GROQ_API_KEY',
        keyPrefix:    'gsk_',
    },
    gemini: {
        baseUrl:      'https://generativelanguage.googleapis.com/v1beta/openai',
        defaultModel: 'gemini-2.0-flash',
        timeout:      120_000,
        keyEnv:       'GEMINI_API_KEY',
        keyPrefix:    'AIza',
    },
    ollama: {
        baseUrl:      `${process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'}/v1`,
        defaultModel: process.env.OLLAMA_MODEL ?? 'qwen2.5:14b',
        timeout:      600_000,
        keyEnv:       '',        // no key needed
        keyPrefix:    '',
    },
} as const;

// ── Main loop ─────────────────────────────────────────────────────────────────

export async function runAgentLoop(opts: {
    task:           string;
    system:         string;
    tools:          ToolDefinition[];
    dispatch:       ToolDispatch;
    onEvent:        OnEvent;
    modelOverride?: string;
}): Promise<void> {
    const { task, system, tools, dispatch, onEvent, modelOverride } = opts;
    const backend = resolveBackend(modelOverride);
    const startMs = Date.now();

    const WRITE_TOOLS = new Set([
        'save_post', 'add_section', 'create_page', 'publish_site',
        'write_file', 'set_layout_mode', 'create_backup', 'restore_backup',
    ]);

    // ── Claude ────────────────────────────────────────────────────────────────

    if (backend === 'claude') {
        const claudeTools: Anthropic.Tool[] = tools.map(t => ({
            name:         t.name,
            description:  t.description,
            input_schema: t.input_schema,
        }));

        const messages: Anthropic.MessageParam[] = [{ role: 'user', content: task }];
        let turns = 0;

        while (turns < MAX_TURNS) {
            turns++;
            const response = await getAnthropic().messages.create({
                model:      modelOverride ?? (process.env.CLAUDE_MODEL ?? 'claude-opus-4-5'),
                max_tokens: 8192,
                system,
                tools:      claudeTools,
                messages,
            });

            for (const block of response.content) {
                if (block.type === 'text' && block.text.trim()) {
                    onEvent({ type: 'text', text: block.text });
                }
            }

            const toolBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
            if (toolBlocks.length === 0 || response.stop_reason === 'end_turn') break;

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const call of toolBlocks) {
                const isWrite = WRITE_TOOLS.has(call.name);
                onEvent({ type: 'tool_call', name: call.name, input: call.input as Record<string, unknown>, isWrite });
                try {
                    const result = await dispatch(call.name, call.input as Record<string, unknown>);
                    onEvent({ type: 'tool_result', name: call.name, result, isError: false, isWrite });
                    toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: result });
                } catch (err) {
                    const msg = (err as Error).message;
                    onEvent({ type: 'tool_result', name: call.name, result: msg, isError: true, isWrite });
                    toolResults.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify({ error: msg }), is_error: true });
                }
            }
            messages.push({ role: 'assistant', content: response.content });
            messages.push({ role: 'user',      content: toolResults });
        }

        if (turns >= MAX_TURNS) onEvent({ type: 'warn', message: `Hit ${MAX_TURNS}-turn limit.` });
        onEvent({ type: 'done', turns, durationMs: Date.now() - startMs });
        return;
    }

    // ── Groq / Gemini / Ollama (shared OpenAI-compatible path) ───────────────

    const cfg     = BACKENDS[backend];
    const apiKey  = backend === 'ollama' ? 'ollama' : (process.env[cfg.keyEnv] ?? '');
    const model   = modelOverride ?? cfg.defaultModel;

    if (backend !== 'ollama' && !apiKey.startsWith(cfg.keyPrefix)) {
        onEvent({
            type:    'error',
            message: `${cfg.keyEnv} is not set. Add it to .env.local` +
                     (backend === 'groq'   ? ' (free key at groq.com).'   : '') +
                     (backend === 'gemini' ? ' (free key at ai.google.dev).' : ''),
        });
        return;
    }

    const messages: OAIMessage[] = [{ role: 'user', content: task }];
    let turns = 0;

    while (turns < MAX_TURNS) {
        turns++;
        const { text, calls } = await openAICompatChat({
            baseUrl: cfg.baseUrl, apiKey, model, system, messages, tools, timeout: cfg.timeout,
        });

        if (text.trim()) onEvent({ type: 'text', text });
        if (calls.length === 0) break;

        // content must be null (not '') when tool_calls are present — Groq/strict OpenAI spec
        messages.push({
            role:       'assistant',
            content:    text || null,
            tool_calls: calls.map(c => ({
                id:       c.id,
                type:     'function' as const,
                function: { name: c.name, arguments: JSON.stringify(c.input) },
            })),
        });

        for (const call of calls) {
            const isWrite = WRITE_TOOLS.has(call.name);
            onEvent({ type: 'tool_call', name: call.name, input: call.input, isWrite });
            try {
                const result = await dispatch(call.name, call.input);
                onEvent({ type: 'tool_result', name: call.name, result, isError: false, isWrite });
                messages.push({ role: 'tool', content: result, tool_call_id: call.id });
            } catch (err) {
                const msg = (err as Error).message;
                onEvent({ type: 'tool_result', name: call.name, result: msg, isError: true, isWrite });
                messages.push({ role: 'tool', content: JSON.stringify({ error: msg }), tool_call_id: call.id });
            }
        }
    }

    if (turns >= MAX_TURNS) onEvent({ type: 'warn', message: `Hit ${MAX_TURNS}-turn limit.` });
    onEvent({ type: 'done', turns, durationMs: Date.now() - startMs });
}
