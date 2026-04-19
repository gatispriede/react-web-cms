/**
 * Optimistic-concurrency primitives for service writes.
 *
 * Every editable doc carries an integer `version` field, bumped on each
 * mutation server-side. Callers that opt into conflict protection pass
 * `expectedVersion`; the helper compares against the on-disk version and
 * throws `ConflictError` (carrying the current server doc) when they
 * disagree. The MongoQuery layer in `mongoDBConnection.ts` catches the
 * error and serialises it through GraphQL as a JSON wrapper the frontend
 * detects in API wrappers — see `src/frontend/lib/conflict.ts`.
 *
 * Callers that omit `expectedVersion` apply the write unconditionally
 * (legacy path, kept for backward compatibility while editor surfaces
 * are migrated). Their saves still bump `version`, so any conflict-aware
 * peer reading the doc will see a newer number on its next save.
 */

export class ConflictError<T = unknown> extends Error {
    public readonly conflict = true as const;
    public readonly currentDoc: T;
    public readonly currentVersion: number;
    constructor(message: string, currentDoc: T, currentVersion: number) {
        super(message);
        this.name = 'ConflictError';
        this.currentDoc = currentDoc;
        this.currentVersion = currentVersion;
    }
}

export function isConflictError(err: unknown): err is ConflictError<unknown> {
    return Boolean(err && typeof err === 'object' && (err as {conflict?: boolean}).conflict === true);
}

/**
 * Throw if `expectedVersion` is provided and disagrees with the on-disk
 * `existingVersion`. Both `null` and `undefined` mean "caller didn't ask
 * for the check". The on-disk value is treated as 0 when the doc has
 * never been versioned (pre-migration data).
 */
export function requireVersion<T>(
    existingDoc: T,
    existingVersion: number | undefined | null,
    expectedVersion: number | undefined | null,
    docKind: string,
): void {
    if (expectedVersion === undefined || expectedVersion === null) return;
    const onDisk = typeof existingVersion === 'number' ? existingVersion : 0;
    if (onDisk !== expectedVersion) {
        throw new ConflictError(
            `${docKind} has been edited by someone else (server version ${onDisk}, you sent ${expectedVersion}).`,
            existingDoc,
            onDisk,
        );
    }
}

/** Next version number for a write. New docs start at 1. */
export function nextVersion(existingVersion: number | undefined | null): number {
    const onDisk = typeof existingVersion === 'number' ? existingVersion : 0;
    return onDisk + 1;
}

/**
 * Serialise a `ConflictError` thrown inside a service into the JSON shape
 * the frontend expects. Used by mutation wrappers in `mongoDBConnection.ts`.
 */
export function serialiseConflict(err: ConflictError<unknown>): string {
    return JSON.stringify({
        conflict: true,
        currentVersion: err.currentVersion,
        currentDoc: err.currentDoc,
        message: err.message,
    });
}
