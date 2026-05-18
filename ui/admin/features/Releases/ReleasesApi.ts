/**
 * Thin fetch wrapper for the admin Releases REST surface.
 *
 * Posts `{op, ...args}` to `/api/releases`. Mirrors the dispatch table
 * on the server side (`pages/api/releases.ts`). Centralised so the
 * Releases ViewModel has zero `fetch()` calls inline.
 */
import type {IRelease, IReleaseSummary, ReleaseEntityKind, ReleaseStatus} from '@interfaces/IRelease';

async function call<T>(op: string, body: Record<string, unknown>): Promise<T> {
    const res = await fetch('/api/releases', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({op, ...body}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? `releases.${op} failed: ${res.status}`);
    return data as T;
}

export const releasesApi = {
    list: (status?: ReleaseStatus) => call<IReleaseSummary[]>('list', {status}),
    get: (id: string) => call<IRelease | null>('get', {id}),
    create: (title: string, description?: string) => call<IRelease>('create', {title, description}),
    update: (id: string, patch: Partial<Pick<IRelease, 'title' | 'description' | 'scheduledFor'>>, expectedVersion?: number) =>
        call<IRelease>('update', {id, patch, expectedVersion}),
    delete: (id: string) => call<{deleted: true}>('delete', {id}),
    attach: (releaseId: string, entity: ReleaseEntityKind, id: string) =>
        call<IRelease>('attach', {releaseId, entity, id}),
    detach: (releaseId: string, entity: ReleaseEntityKind, id: string) =>
        call<IRelease>('detach', {releaseId, entity, id}),
    publish: (id: string, expectedVersion?: number) =>
        call<IRelease>('publish', {id, expectedVersion}),
    rollback: (id: string) => call<IRelease>('rollback', {id}),
    previewAt: (id: string) => call<{releaseId: string; members: unknown[]}>('previewAt', {id}),
};
