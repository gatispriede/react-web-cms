/**
 * Tiny browser-side wrapper around the public `/api/mcp/tools/call`
 * endpoint. The customer-stack token is supplied via the same-origin
 * `cms.customer-session` cookie — no header threading required.
 *
 * Centralised here so the 10 AccountSettings components don't each
 * roll their own fetch boilerplate. Keeps the bundle paths from
 * sprawling and parses the F8 envelope consistently.
 */
export async function mcpCall<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    const res = await fetch('/api/mcp/tools/call', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({name, arguments: args}),
    });
    if (!res.ok) throw new Error(`MCP ${name} failed: ${res.status}`);
    const env = await res.json();
    const text = env?.content?.[0]?.text ?? JSON.stringify(env);
    const parsed = JSON.parse(text);
    if (parsed?.ok === false) throw new Error(parsed?.error?.message || 'MCP error');
    return (parsed?.data ?? parsed) as T;
}
