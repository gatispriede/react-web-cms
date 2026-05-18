/**
 * Image-record metadata helper (C2 follow-up — close the deferred gap).
 *
 * The shared `imageOptimize.ts` pipeline already computes `width` / `height`
 * / output `size` / `format` / `optimised` for every upload (see
 * `OptimizeResult`). What was still missing — and what the
 * `image-optimization-on-upload` spec lists under "Data model" — is
 * *persisting* those values (plus provenance: `originalName` / `uploadedBy`
 * / `uploadedAt`) onto the stored image record so downstream consumers
 * (picker orientation filter, gallery sizing) don't need an extra
 * round-trip to re-read the file off disk.
 *
 * Why a helper rather than a straight object literal in the upload routes:
 *
 * - `InImage` is a GraphQL-generated input type and does NOT (yet) declare
 *   `width` / `height` / `sizeBytes` / `originalName` / `uploadedBy` /
 *   `uploadedAt`. Adding them to the SDL + regenerating the typed client +
 *   back-filling Mongo is a separate cross-cutting migration. Until that
 *   lands, these fields are **write-through-only**: Mongo is schemaless so
 *   `imagesDB.insertOne({...})` persists them fine, and `getImages()`
 *   returns the raw docs — they're just not yet exposed as typed GraphQL
 *   fields. Persisting now means the SDL migration is a pure read-side
 *   change with no back-fill needed for anything uploaded after this ships.
 * - Centralising the shape keeps `/api/upload` and `/api/upload-batch`
 *   building the *same* record — the spec's whole point is one pipeline,
 *   one record shape, both entry points.
 *
 * `PersistedImageRecord` is a structural superset of `InImage`, so it's
 * assignable to `assetService.saveImage(image: InImage)` without a cast
 * (the extra fields ride along into Mongo).
 */
import type {InImage} from '@interfaces/IImage';
import type {OptimizeResult} from '@services/features/Assets/imageOptimize';

/**
 * The on-disk image record as actually persisted to Mongo. Extends the
 * GraphQL-generated `InImage` with the optimisation/provenance metadata
 * the spec's "Data model" section calls for. Fields beyond `InImage` are
 * optional so a partial back-fill (rescan of pre-existing files that can't
 * recover `originalName` / `uploadedBy`) stays valid.
 */
export interface PersistedImageRecord extends InImage {
    /** Output pixel width after the optimise pipeline. */
    width?: number;
    /** Output pixel height after the optimise pipeline. */
    height?: number;
    /** Output size in bytes — mirrors `size`, named to match the spec's `sizeBytes`. */
    sizeBytes?: number;
    /** The filename the uploader sent, before collision-safe renaming. */
    originalName?: string;
    /** User id / email of the uploading session, when known. */
    uploadedBy?: string;
    /** Upload timestamp (ISO string — Mongo stores it, GraphQL `created` stays the legacy date string). */
    uploadedAt?: string;
    /**
     * Whether the optimise pipeline actually shrank the file (`true`) or the
     * size guard kept the original bytes (`false`). Lets the admin surface
     * "optimised −63%" vs "kept original" without re-deriving it.
     */
    optimised?: boolean;
    /** Input format sharp detected (jpeg/png/webp/avif/gif/svg) — `null` when unreadable. */
    format?: string | null;
}

/** Inputs the helper needs that aren't part of the `OptimizeResult`. */
export interface BuildImageRecordInput {
    /** Stable image id (caller-generated `guid()`). */
    id: string;
    /** Collision-safe filename actually written to `public/images/`. */
    storedName: string;
    /** Public `location` path (`${PUBLIC_IMAGE_PATH}${storedName}`). */
    location: string;
    /** MIME type to record on the GraphQL `type` field. */
    type: string;
    /** Tags to attach (the caller has already merged in `'All'`). */
    tags: (string | null)[];
    /** The uploader-supplied filename, pre-rename. */
    originalName: string;
    /** Uploading session identity (email / id), when resolvable. */
    uploadedBy?: string;
    /** Fallback byte size when `OptimizeResult.size` is unavailable (e.g. formidable `file.size`). */
    fallbackSize?: number;
    /** Override the timestamp — defaults to "now". Mostly for tests. */
    now?: Date;
}

/**
 * Build the full persisted record from an `OptimizeResult` + the surrounding
 * upload context. The single source of truth for what an uploaded image
 * record looks like — both upload endpoints call this.
 */
export function buildImageRecord(
    opt: OptimizeResult,
    input: BuildImageRecordInput,
): PersistedImageRecord {
    const now = input.now ?? new Date();
    const size = opt.size ?? input.fallbackSize ?? 0;
    return {
        // --- GraphQL `InImage` fields (typed, queryable today) ---
        id: input.id,
        name: input.storedName,
        location: input.location,
        created: now.toDateString(),
        type: input.type,
        size,
        tags: input.tags,
        // --- write-through metadata (persisted now, GraphQL SDL migration pending) ---
        width: opt.width,
        height: opt.height,
        sizeBytes: size,
        originalName: input.originalName,
        uploadedBy: input.uploadedBy,
        uploadedAt: now.toISOString(),
        optimised: opt.optimised,
        format: opt.format ?? null,
    };
}
