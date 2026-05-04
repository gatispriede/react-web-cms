import {observable} from '@client/lib/state/observable';

/**
 * Agent panel view-models — VM3 migration for the AI Agent chat pane.
 *
 * The pane is composed of several sub-components, each previously holding
 * its own `useState` wall:
 *   - `AgentPanel`     — main chat: messages, input, mode, model, streaming.
 *   - `ApiKeyPanel`    — settings drawer: per-provider API keys.
 *   - `MessageRow`     — per-row "show details" toggle.
 *   - `SmartResult`    — per-row "raw / expand" toggle.
 *
 * Each gets a tiny VM so all field writes flow through `observable()`.
 * Refs (`scrollRef`, `agentMsgRef`, `pendingToolRef`, `abortRef`,
 * `autoScrollRef`) stay in the component — they hold DOM/transient state
 * that should never trigger re-renders.
 */

export type AgentMode  = 'content' | 'both';
export type AgentModel = '' | 'claude-opus-4-5' | 'claude-sonnet-4-5' | 'llama-3.3-70b-versatile' | 'gemini-2.0-flash' | 'qwen2.5:14b' | 'qwen2.5:32b';

export type MsgKind = 'user' | 'agent' | 'tool' | 'info';

export interface ChatMessage {
    id:       number;
    kind:     MsgKind;
    text?:    string;
    tool?:    string;
    input?:   string;
    result?:  string;
    isWrite?: boolean;
    isError?: boolean;
}

export interface AgentEvent {
    type:        'text' | 'tool_call' | 'tool_result' | 'warn' | 'done' | 'error';
    text?:       string;
    name?:       string;
    input?:      Record<string, unknown>;
    result?:     string;
    isWrite?:    boolean;
    isError?:    boolean;
    message?:    string;
    turns?:      number;
    durationMs?: number;
}

let seq = 0;
const nextId = () => ++seq;

export class AgentPanelViewModel {
    messages:     ChatMessage[] = [];
    input        = '';
    running      = false;
    mode:  AgentMode  = 'content';
    model: AgentModel = '';
    statusMsg    = '';
    showSettings = false;

    constructor() { return observable(this); }

    setInput(v: string): void { this.input = v; }
    setMode(v: AgentMode): void { this.mode = v; }
    setModel(v: AgentModel): void { this.model = v; }
    toggleSettings(): void { this.showSettings = !this.showSettings; }

    push(msg: Omit<ChatMessage, 'id'>): number {
        const id = nextId();
        this.messages = [...this.messages, {id, ...msg}];
        return id;
    }

    updateById(id: number, patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)): void {
        this.messages = this.messages.map(m => {
            if (m.id !== id) return m;
            const resolved = typeof patch === 'function' ? patch(m) : patch;
            return {...m, ...resolved};
        });
    }

    finish(statusMsg: string): void {
        this.running = false;
        this.statusMsg = statusMsg;
    }

    start(): void {
        this.running = true;
        this.statusMsg = 'Running…';
    }
}

export interface KeyStatus { set: boolean; masked: string; label: string; }
export type KeyMap = Record<string, KeyStatus>;

export class ApiKeyPanelViewModel {
    keys:    KeyMap = {};
    inputs:  Record<string, string> = {};
    saving:  string | null = null;
    error:   string | null = null;

    constructor() { return observable(this); }

    setInput(varName: string, value: string): void {
        this.inputs = {...this.inputs, [varName]: value};
    }

    async load(): Promise<void> {
        try {
            const r = await fetch('/api/agent/keys');
            this.keys = await r.json();
        } catch {
            this.error = 'Could not load key status';
        }
    }

    async save(varName: string): Promise<void> {
        const value = this.inputs[varName]?.trim() ?? '';
        this.saving = varName;
        this.error = null;
        try {
            const res  = await fetch('/api/agent/keys', {
                method:  'POST',
                headers: {'Content-Type': 'application/json'},
                body:    JSON.stringify({varName, value}),
            });
            const data = await res.json();
            if (!res.ok) { this.error = data.error ?? 'Save failed'; return; }
            this.keys   = {...this.keys,   [varName]: {...this.keys[varName], set: data.set, masked: data.masked}};
            this.inputs = {...this.inputs, [varName]: ''};
        } catch { this.error = 'Network error'; }
        finally  { this.saving = null; }
    }

    clear(varName: string): Promise<void> {
        this.inputs = {...this.inputs, [varName]: ' '};
        return this.save(varName);
    }
}

/** Per-row toggle VM — shared by SmartResult and MessageRow. */
export class ToggleViewModel {
    on = false;
    constructor() { return observable(this); }
    toggle(): void { this.on = !this.on; }
}
