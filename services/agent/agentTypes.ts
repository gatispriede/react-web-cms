/**
 * Shared types for the inline CMS agent.
 *
 * Events mirror the protocol used by the standalone local-llm server
 * (D:\Work\Experiments\AI\src\ui\server.js) so the same AgentPanel.tsx
 * can be pointed at either backend.
 */

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

export type OnEvent = (event: AgentEvent) => void;

/** Subset of an Anthropic tool definition (compatible with Ollama too). */
export interface ToolDefinition {
    name:        string;
    description: string;
    input_schema: {
        type:        'object';
        properties:  Record<string, unknown>;
        required?:   string[];
    };
}

export type ToolDispatch = (name: string, input: Record<string, unknown>) => Promise<string>;
