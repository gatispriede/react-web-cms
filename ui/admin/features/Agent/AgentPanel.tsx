/**
 * AI Agent panel — chat UI backed by /api/agent/stream (SSE).
 *
 * Features:
 * - Streaming SSE chat with tool call visualization
 * - Smart result rendering: images as thumbnails, JSON as formatted, text as text
 * - Image gallery panel (all server images, toggled from toolbar)
 * - Technical details (raw JSON input) collapsed behind a "Details" toggle
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Button, Input, Select, Tag, Typography } from 'antd';
import { SendOutlined, SettingOutlined } from '@client/lib/icons';
import { useViewModel } from '@client/lib/state/observable';
import {
    AgentPanelViewModel,
    ApiKeyPanelViewModel,
    ToggleViewModel,
    type AgentEvent,
    type AgentMode,
    type AgentModel,
    type ChatMessage,
} from './AgentPanelViewModel';

const { Text } = Typography;

const TOOL_LABELS: Record<string, string> = {
    list_posts:      'Reading blog posts…',
    save_post:       'Saving blog post…',
    list_pages:      'Reading pages…',
    list_sections:   'Reading page content…',
    create_page:     'Creating page…',
    add_section:     'Adding content block…',
    publish_site:    'Publishing changes…',
    list_images:     'Looking up images…',
    create_backup:   'Creating backup…',
    restore_backup:  'Restoring backup…',
    set_layout_mode: 'Changing navigation style…',
};

// ── SmartResult ───────────────────────────────────────────────────────────────
// Renders tool result intelligently: images as thumbnails, ok→green tick, else formatted.

const SmartResult: React.FC<{ toolName: string; result: string; isError?: boolean }> = ({
    toolName, result, isError,
}) => {
    const vm = useViewModel(() => new ToggleViewModel());
    if (!result || result === '…') return null;

    if (isError) return (
        <div style={{ padding: '5px 10px', color: '#ff4d4f', fontSize: 12,
                      borderTop: '1px solid #f0f0f0', whiteSpace: 'pre-wrap' }}>
            {result}
        </div>
    );

    let parsed: unknown = null;
    try { parsed = JSON.parse(result); } catch { /* plain text */ }

    // Image list → thumbnail grid
    if (toolName === 'list_images' && Array.isArray(parsed)) {
        const imgs = parsed as Array<{ name: string; url: string }>;
        return (
            <div style={{ padding: '8px 10px', borderTop: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 5 }}>
                    <Text style={{ fontSize: 11, color: '#888' }}>{imgs.length} images found</Text>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: '#bbb', cursor: 'pointer' }}
                          onClick={vm.toggle}>
                        {vm.on ? 'thumbnails' : 'raw'}
                    </span>
                </div>
                {vm.on
                    ? <pre style={{ margin: 0, fontSize: 10, color: '#999', whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-all', maxHeight: 120, overflow: 'auto' }}>
                        {result}
                      </pre>
                    : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {imgs.slice(0, 16).map(img => (
                            <img key={img.url} src={`/${img.url}`} alt={img.name} title={img.name}
                                 style={{ width: 52, height: 38, objectFit: 'cover', borderRadius: 3,
                                          border: '1px solid #ebebeb', flexShrink: 0 }}
                                 onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        ))}
                        {imgs.length > 16 && (
                            <div style={{ width: 52, height: 38, borderRadius: 3, border: '1px solid #ebebeb',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: 10, color: '#aaa', background: '#fafafa' }}>
                                +{imgs.length - 16}
                            </div>
                        )}
                      </div>
                }
            </div>
        );
    }

    // Simple ok response → green tick summary
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        if (obj.ok === true && Object.keys(obj).length <= 5) {
            const detail = obj.sectionId ? `section ${String(obj.sectionId).slice(0, 8)}…`
                : obj.id           ? `snapshot ${String(obj.id).slice(0, 8)}…`
                : obj.layoutMode   ? `mode → ${obj.layoutMode}`
                : obj.note !== undefined ? 'backup saved'
                : obj.page         ? `page "${obj.page}"`
                : '';
            return (
                <div style={{ padding: '5px 10px', color: '#389e0d', fontSize: 12,
                              borderTop: '1px solid #f0f0f0' }}>
                    ✓ {detail || 'Done'}
                </div>
            );
        }
        if (obj.error) return (
            <div style={{ padding: '5px 10px', color: '#ff4d4f', fontSize: 12,
                          borderTop: '1px solid #f0f0f0' }}>
                ✗ {String(obj.error)}
            </div>
        );
    }

    // JSON array / complex object → collapsed by default, expand on demand
    if (parsed !== null && typeof parsed === 'object') {
        // Build a short summary line
        let summary = '';
        if (Array.isArray(parsed)) {
            const arr = parsed as Record<string, unknown>[];
            const n   = arr.length;
            if (n === 0) {
                summary = 'empty';
            } else {
                // Try to list names/pages/titles if available
                const labels = arr.slice(0, 5)
                    .map(item => item?.page ?? item?.title ?? item?.name ?? item?.slug ?? null)
                    .filter(Boolean) as string[];
                if (labels.length) {
                    summary = `${n} item${n !== 1 ? 's' : ''}: ${labels.join(', ')}${n > 5 ? '…' : ''}`;
                } else {
                    summary = `${n} item${n !== 1 ? 's' : ''}`;
                }
            }
        } else {
            const keys = Object.keys(parsed as object);
            summary = keys.slice(0, 4).join(', ') + (keys.length > 4 ? '…' : '');
        }

        return (
            <div style={{ borderTop: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', padding: '4px 10px', gap: 6 }}>
                    <span style={{ fontSize: 11, color: '#888', flex: 1 }}>{summary}</span>
                    <span style={{ fontSize: 10, color: '#bfbfbf', cursor: 'pointer',
                                   padding: '0 4px', border: '1px solid #e8e8e8', borderRadius: 3,
                                   background: '#fff', userSelect: 'none', flexShrink: 0 }}
                          onClick={vm.toggle}>
                        {vm.on ? 'collapse' : 'expand'}
                    </span>
                </div>
                {vm.on && (
                    <pre style={{ margin: 0, padding: '4px 10px 6px', fontSize: 10, color: '#999',
                                  whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                                  maxHeight: 200, overflow: 'auto', borderTop: '1px solid #f5f5f5' }}>
                        {JSON.stringify(parsed, null, 2)}
                    </pre>
                )}
            </div>
        );
    }

    // Plain text fallback — show first 120 chars, expand on demand
    const SHORT_LIMIT = 120;
    const isLong = result.length > SHORT_LIMIT;
    return (
        <div style={{ borderTop: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', padding: '4px 10px', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#555', flex: 1,
                               whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {vm.on || !isLong ? result : result.slice(0, SHORT_LIMIT) + '…'}
                </span>
                {isLong && (
                    <span style={{ fontSize: 10, color: '#bfbfbf', cursor: 'pointer',
                                   padding: '0 4px', border: '1px solid #e8e8e8', borderRadius: 3,
                                   background: '#fff', userSelect: 'none', flexShrink: 0 }}
                          onClick={vm.toggle}>
                        {vm.on ? 'less' : 'more'}
                    </span>
                )}
            </div>
        </div>
    );
};

// ── ApiKeyPanel ───────────────────────────────────────────────────────────────
// Compact settings panel for managing Groq / Gemini / Claude API keys.
// Keys are saved to .env.local server-side and applied to process.env immediately.

const KEY_ROWS: { varName: string; label: string; placeholder: string; docsUrl: string }[] = [
    { varName: 'GROQ_API_KEY',      label: 'Groq',   placeholder: 'gsk_…',   docsUrl: 'https://console.groq.com/keys' },
    { varName: 'GEMINI_API_KEY',    label: 'Gemini', placeholder: 'AIza…',   docsUrl: 'https://ai.google.dev/gemini-api/docs/api-key' },
    { varName: 'ANTHROPIC_API_KEY', label: 'Claude', placeholder: 'sk-ant-…', docsUrl: 'https://console.anthropic.com/settings/keys' },
];

const ApiKeyPanel: React.FC = () => {
    const vm = useViewModel(() => new ApiKeyPanelViewModel());

    useEffect(() => { void vm.load(); }, [vm]);

    return (
        <div style={{ borderTop: '2px solid #f0f0f0', background: '#fafafa',
                      padding: '10px 16px', flexShrink: 0 }}>
            <Text style={{ fontSize: 11, color: '#aaa', display: 'block', marginBottom: 8 }}>
                API Keys — saved to server, applied immediately (no restart needed)
            </Text>
            {vm.error && <div style={{ color: '#ff4d4f', fontSize: 11, marginBottom: 6 }}>{vm.error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {KEY_ROWS.map(({ varName, label, placeholder, docsUrl }) => {
                    const status = vm.keys[varName];
                    return (
                        <div key={varName} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#666', width: 52, flexShrink: 0 }}>{label}</span>
                            {status?.set
                                ? <span style={{ fontSize: 11, color: '#52c41a', fontFamily: 'monospace', flex: 1 }}>
                                    ✓ {status.masked}
                                  </span>
                                : <span style={{ fontSize: 11, color: '#bbb', flex: 1 }}>not set</span>
                            }
                            <Input.Password
                                size="small"
                                placeholder={placeholder}
                                value={vm.inputs[varName] ?? ''}
                                onChange={e => vm.setInput(varName, e.target.value)}
                                style={{ flex: 2, fontSize: 11, maxWidth: 240 }}
                                onPressEnter={() => vm.save(varName)}
                            />
                            <Button size="small" type="primary"
                                    loading={vm.saving === varName}
                                    disabled={!vm.inputs[varName]?.trim()}
                                    onClick={() => vm.save(varName)}
                                    style={{ fontSize: 11 }}>
                                Save
                            </Button>
                            {status?.set && (
                                <Button size="small" danger
                                        loading={vm.saving === varName}
                                        onClick={() => vm.clear(varName)}
                                        style={{ fontSize: 11 }}>
                                    Clear
                                </Button>
                            )}
                            <a href={docsUrl} target="_blank" rel="noreferrer"
                               style={{ fontSize: 10, color: '#bbb', whiteSpace: 'nowrap' }}>
                                get key ↗
                            </a>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── AgentPanel ────────────────────────────────────────────────────────────────

const AgentPanel: React.FC = () => {
    const vm = useViewModel(() => new AgentPanelViewModel());

    const scrollRef      = useRef<HTMLDivElement>(null);
    const agentMsgRef    = useRef<number | null>(null);
    const pendingToolRef = useRef<{ id: number; name: string } | null>(null);
    const abortRef       = useRef<AbortController | null>(null);
    const autoScrollRef  = useRef(true);

    useEffect(() => {
        if (!autoScrollRef.current) return;
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [vm.messages]);

    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        autoScrollRef.current = (el.scrollHeight - el.scrollTop - el.clientHeight) < 60;
    };

    const scrollBottom = () => {
        autoScrollRef.current = true;
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    };

    const handleEvent = useCallback((ev: AgentEvent) => {
        switch (ev.type) {
            case 'text': {
                if (agentMsgRef.current === null) {
                    agentMsgRef.current = vm.push({ kind: 'agent', text: ev.text ?? '' });
                } else {
                    vm.updateById(agentMsgRef.current, m => ({ text: (m.text ?? '') + '\n\n' + (ev.text ?? '') }));
                }
                scrollBottom();
                break;
            }
            case 'tool_call': {
                agentMsgRef.current = null;
                const id = vm.push({ kind: 'tool', tool: ev.name ?? '?',
                    input: JSON.stringify(ev.input, null, 2), result: '…', isWrite: ev.isWrite });
                pendingToolRef.current = { id, name: ev.name ?? '' };
                scrollBottom();
                break;
            }
            case 'tool_result': {
                const pending = pendingToolRef.current;
                if (pending && pending.name === ev.name) {
                    vm.updateById(pending.id, { result: ev.result ?? '', isError: ev.isError });
                    pendingToolRef.current = null;
                }
                scrollBottom();
                break;
            }
            case 'warn':  vm.push({ kind: 'info', text: `⚠ ${ev.message ?? ''}` }); scrollBottom(); break;
            case 'done': {
                const secs = ((ev.durationMs ?? 0) / 1000).toFixed(1);
                vm.push({ kind: 'info', text: `✓ Done — ${ev.turns} turn${ev.turns === 1 ? '' : 's'}, ${secs}s` });
                vm.finish(`Finished in ${secs}s`);
                agentMsgRef.current = null;
                scrollBottom();
                break;
            }
            case 'error': {
                vm.push({ kind: 'info', text: `✗ ${ev.message ?? 'Unknown error'}` });
                vm.finish(`Error: ${ev.message}`);
                agentMsgRef.current = null;
                scrollBottom();
                break;
            }
        }
    }, [vm]);

    const send = async () => {
        const task = vm.input.trim();
        if (!task || vm.running) return;
        vm.push({ kind: 'user', text: task });
        vm.setInput('');
        vm.start();
        agentMsgRef.current    = null;
        pendingToolRef.current = null;
        autoScrollRef.current  = true;
        scrollBottom();

        const ctrl = new AbortController();
        abortRef.current = ctrl;
        try {
            const res = await fetch('/api/agent/stream', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ task, mode: vm.mode, model: vm.model || null }),
                signal:  ctrl.signal,
            });
            if (!res.ok) {
                const body = await res.text().catch(() => res.statusText);
                handleEvent({ type: 'error', message: `HTTP ${res.status}: ${body}` });
                return;
            }
            const reader  = res.body!.getReader();
            const decoder = new TextDecoder();
            let   buffer  = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try { handleEvent(JSON.parse(line.slice(6)) as AgentEvent); } catch { /* skip */ }
                    }
                }
            }
        } catch (err: unknown) {
            if ((err as Error).name !== 'AbortError') {
                handleEvent({ type: 'error', message: (err as Error).message });
            }
        } finally {
            vm.running = false;
            abortRef.current = null;
        }
    };

    const cancel = () => { abortRef.current?.abort(); vm.finish('Cancelled'); };
    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
    };

    return (
        <div data-testid="agent-panel"
             style={{
                 display: 'flex', flexDirection: 'column', minHeight: 0,
                 // Clamp to viewport so the panel never overflows the screen.
                 // 82px = ~50px top-nav bar + 16px content padding top + 16px bottom.
                 height: 'calc(100vh - 82px)',
                 maxHeight: 'calc(100vh - 82px)',
             }}>

            {/* Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                          borderBottom: '1px solid #f0f0f0', flexShrink: 0, flexWrap: 'nowrap', minWidth: 0 }}>
                <Select<AgentMode>
                    data-testid="agent-mode-select"
                    value={vm.mode} onChange={vm.setMode} disabled={vm.running} size="small" style={{ width: 140 }}
                    options={[
                        { value: 'content', label: '💬 Chat only' },
                        { value: 'both',    label: '✏️ Can make changes' },
                    ]}
                />
                <Select<AgentModel>
                    data-testid="agent-model-select"
                    value={vm.model} onChange={vm.setModel} disabled={vm.running} size="small" style={{ width: 160 }}
                    options={[
                        { value: '',                         label: '⚡ Auto' },
                        { value: 'claude-opus-4-5',          label: '☁️ Claude Opus' },
                        { value: 'claude-sonnet-4-5',        label: '☁️ Claude Sonnet' },
                        { value: 'llama-3.3-70b-versatile',  label: '🟡 Groq · Llama 3.3' },
                        { value: 'gemini-2.0-flash',         label: '🔵 Gemini 2.0 Flash' },
                        { value: 'qwen2.5:14b',              label: '🖥️ Local · fast' },
                        { value: 'qwen2.5:32b',              label: '🖥️ Local · smart' },
                    ]}
                />
                <Button size="small" icon={<SettingOutlined />}
                        type={vm.showSettings ? 'primary' : 'default'}
                        onClick={vm.toggleSettings}
                        style={{ marginLeft: 'auto' }} />
                {vm.statusMsg && (
                    <Text data-testid="agent-status" type="secondary"
                          style={{ fontSize: 11, whiteSpace: 'nowrap',
                                   overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                        {vm.statusMsg}
                    </Text>
                )}
                {vm.running && (
                    <Button data-testid="agent-cancel-btn" size="small" danger onClick={cancel}>Cancel</Button>
                )}
            </div>

            {/* Messages */}
            <div data-testid="agent-messages" ref={scrollRef} onScroll={onScroll}
                 style={{ flex: 1, overflowY: 'auto', padding: '12px 16px',
                          display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
                {vm.messages.length === 0 && (
                    <div data-testid="agent-empty-state"
                         style={{ margin: 'auto', textAlign: 'center', color: '#bfbfbf',
                                  userSelect: 'none', maxWidth: 360 }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>⚡</div>
                        <div style={{ fontWeight: 600, fontSize: 15, color: '#999', marginBottom: 8 }}>
                            What would you like to do?
                        </div>
                        <Text type="secondary" style={{ fontSize: 13, lineHeight: 1.7 }}>
                            Try: <em>"Write a blog post about our summer sale"</em><br/>
                            or <em>"Add a contact section to the homepage"</em><br/>
                            or <em>"What pages do we have?"</em>
                        </Text>
                    </div>
                )}
                {vm.messages.map(msg => <MessageRow key={msg.id} msg={msg} />)}
            </div>

            {/* API Key settings panel */}
            {vm.showSettings && <ApiKeyPanel />}

            {/* Compose */}
            <div style={{ display: 'flex', gap: 8, padding: '10px 16px',
                          borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
                <textarea
                    data-testid="agent-task-input"
                    value={vm.input}
                    onChange={e => vm.setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    disabled={vm.running}
                    placeholder="Ask anything or give instructions… (Shift+Enter for new line)"
                    rows={2}
                    style={{ flex: 1, resize: 'none', padding: '8px 10px',
                             border: '1px solid #d9d9d9', borderRadius: 6,
                             fontFamily: 'inherit', fontSize: 14, lineHeight: 1.5,
                             outline: 'none', background: vm.running ? '#fafafa' : '#fff' }}
                />
                <Button
                    data-testid="agent-send-btn"
                    type="primary" icon={<SendOutlined />}
                    onClick={() => void send()}
                    disabled={vm.running || !vm.input.trim()}
                    loading={vm.running}
                    style={{ alignSelf: 'flex-end', height: 38 }}
                >
                    Send
                </Button>
            </div>
        </div>
    );
};

// ── MessageRow ────────────────────────────────────────────────────────────────

const MessageRow: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
    const vm = useViewModel(() => new ToggleViewModel());

    if (msg.kind === 'user') return (
        <div style={{ alignSelf: 'flex-end', maxWidth: '75%' }}>
            <div style={{ background: '#e6673d', color: '#fff', borderRadius: '12px 12px 2px 12px',
                          padding: '8px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          fontSize: 14, lineHeight: 1.6 }}>
                {msg.text}
            </div>
        </div>
    );

    if (msg.kind === 'agent') return (
        <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
            <div style={{ background: '#fafafa', border: '1px solid #f0f0f0',
                          borderRadius: '2px 12px 12px 12px',
                          padding: '8px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          fontSize: 14, lineHeight: 1.6 }}>
                {msg.text}
            </div>
        </div>
    );

    if (msg.kind === 'tool') return (
        <div style={{ fontFamily: 'monospace', fontSize: 12, border: '1px solid #f0f0f0',
                      borderRadius: 6, overflow: 'hidden', maxWidth: '85%' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px',
                          background: '#fafafa', borderBottom: msg.result && msg.result !== '…'
                              ? '1px solid #f0f0f0' : undefined }}>
                {msg.isWrite
                    ? <Tag color="orange" style={{ fontSize: 10, padding: '0 4px', marginRight: 0 }}>saving</Tag>
                    : <Tag color="green"  style={{ fontSize: 10, padding: '0 4px', marginRight: 0 }}>looking up</Tag>
                }
                <span style={{ fontWeight: 600, color: '#555' }}>
                    {TOOL_LABELS[msg.tool ?? ''] ?? msg.tool}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#bfbfbf', cursor: 'pointer',
                               padding: '1px 5px', border: '1px solid #e8e8e8', borderRadius: 3,
                               background: '#fff', userSelect: 'none' }}
                      onClick={vm.toggle}>
                    {vm.on ? 'hide details' : 'details'}
                </span>
            </div>

            {/* Technical details (raw input) — hidden by default */}
            {vm.on && (
                <pre style={{ margin: 0, padding: '6px 10px', color: '#aaa', background: '#fff',
                              maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all', borderBottom: '1px solid #f0f0f0', fontSize: 11 }}>
                    {msg.input}
                </pre>
            )}

            {/* Smart result */}
            <SmartResult toolName={msg.tool ?? ''} result={msg.result ?? ''} isError={msg.isError} />
        </div>
    );

    // info (warn / done / error)
    const isError = msg.text?.startsWith('✗');
    const isWarn  = msg.text?.startsWith('⚠');
    return (
        <div style={{ fontSize: 12, lineHeight: 1.5,
                      color: isError ? '#ff4d4f' : isWarn ? '#faad14' : '#52c41a',
                      whiteSpace: isError ? 'pre-wrap' : 'normal',
                      wordBreak: 'break-word', maxWidth: '85%',
                      background: isError ? '#fff2f0' : undefined,
                      border:     isError ? '1px solid #ffccc7' : undefined,
                      borderRadius: isError ? 6 : undefined,
                      padding:    isError ? '6px 10px' : undefined }}>
            {msg.text}
        </div>
    );
};

export default AgentPanel;
