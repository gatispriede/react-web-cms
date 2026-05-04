/**
 * Tiny GraphQL POSTer for the customer pages. The admin surface uses GQty;
 * for the small set of customer mutations a hand-rolled fetch is simpler
 * and avoids regenerating the GQty schema on every shape change.
 */
export async function gql(query: string, variables: Record<string, any> = {}): Promise<any> {
    const res = await fetch('/api/graphql', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({query, variables}),
    });
    const json = await res.json();
    if (json.errors?.length) {
        throw new Error(json.errors[0]?.message || 'GraphQL error');
    }
    return json.data;
}

export function parseEnvelope(raw: string | undefined): {error?: string} & Record<string, any> {
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {error: 'invalid response'}; }
}
