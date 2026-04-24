/**
 * Frontend mirror of `src/Server/conflict.ts` — detects the conflict-shape
 * JSON the server returns from optimistic-concurrency mutations and turns
 * it into a typed error API wrappers can throw and editor surfaces can
 * catch via the `onConflict` topic.
 */

export interface IConflictPayload<T = unknown> {
    conflict: true;
    currentVersion: number;
    currentDoc: T;
    message?: string;
}

export class ConflictError<T = unknown> extends Error {
    public readonly conflict = true as const;
    public readonly currentDoc: T;
    public readonly currentVersion: number;
    constructor(payload: IConflictPayload<T>) {
        super(payload.message ?? 'Conflict — another editor saved newer changes.');
        this.name = 'ConflictError';
        this.currentDoc = payload.currentDoc;
        this.currentVersion = payload.currentVersion;
    }
}

export function isConflictPayload(value: unknown): value is IConflictPayload {
    return Boolean(
        value && typeof value === 'object' &&
        (value as {conflict?: unknown}).conflict === true &&
        typeof (value as {currentVersion?: unknown}).currentVersion === 'number',
    );
}

export function isConflictError(err: unknown): err is ConflictError<unknown> {
    return Boolean(err && typeof err === 'object' && (err as {conflict?: boolean}).conflict === true && err instanceof Error);
}

/**
 * Parse the JSON response body our mutation wrappers return. If it carries
 * the conflict shape, throw a `ConflictError`; otherwise return the parsed
 * payload for callers to handle as before.
 */
export function parseMutationResponse<T = unknown>(raw: string | null | undefined): T {
    const text = (raw ?? '').trim();
    if (!text) return {} as T;
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return raw as unknown as T;
    }
    if (isConflictPayload(parsed)) throw new ConflictError(parsed);
    return parsed as T;
}

// ---- conflict bus -----------------------------------------------------------
// Editor surfaces (Section editor, Settings tabs) subscribe; API wrappers
// `emit` the typed error so a single ConflictDialog instance can reconcile
// across the whole admin app without each editor wiring its own dialog.
type ConflictHandler = (err: ConflictError<unknown>) => void;
const handlers = new Set<ConflictHandler>();

export function onConflict(handler: ConflictHandler): () => void {
    handlers.add(handler);
    return () => { handlers.delete(handler); };
}

export function emitConflict(err: ConflictError<unknown>): void {
    Array.from(handlers).forEach((h) => {
        try { h(err); } catch (sub) { console.error('[conflict bus] handler threw:', sub); }
    });
}
