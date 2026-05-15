import type {IRedirect} from '@interfaces/IRedirect';

/**
 * RedirectsApi — admin client for the W8h SEO redirect table.
 *
 * Hits the REST endpoint at `/api/seo/redirects` (no GraphQL surface —
 * see the route file for the rationale).
 */
export class RedirectsApi {
    async list(): Promise<IRedirect[]> {
        const r = await fetch('/api/seo/redirects', {credentials: 'same-origin'});
        if (!r.ok) throw new Error(`list failed: ${r.status}`);
        const data = (await r.json()) as {redirects: IRedirect[]};
        return data.redirects ?? [];
    }

    async create(input: IRedirect): Promise<IRedirect> {
        const r = await fetch('/api/seo/redirects', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        });
        if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error(body.error ?? `create failed: ${r.status}`);
        }
        return r.json();
    }

    async update(input: IRedirect): Promise<IRedirect> {
        if (!input.id) throw new Error('redirect.id is required');
        const r = await fetch(`/api/seo/redirects?id=${encodeURIComponent(input.id)}`, {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        });
        if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error(body.error ?? `update failed: ${r.status}`);
        }
        return r.json();
    }

    async delete(id: string): Promise<{deleted: boolean}> {
        const r = await fetch(`/api/seo/redirects?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            credentials: 'same-origin',
        });
        if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            throw new Error(body.error ?? `delete failed: ${r.status}`);
        }
        return r.json();
    }
}

export default RedirectsApi;
