import {InputMaybe} from "@services/api/generated/schema.generated";
import {Maybe} from "graphql/jsutils/Maybe";

export interface IImage {
    id: string
    name: string
    location: string
    created: string
    type: string
    size: number
    tags: Maybe<string>[]
    // --- Additive optional metadata (picker-improvements C5) ---
    // `image-optimization-on-upload` already write-throughs width/height/
    // sizeBytes/uploadedBy/uploadedAt onto every Mongo image doc (see
    // `services/infra/imageMetadata.ts`). They're declared optional here so
    // any consumer that reads the raw doc — `AssetService.getImages` /
    // `listImagesWithUsage` return raw docs — is typed for them without the
    // GraphQL SDL having to expose them yet. The admin picker also derives
    // width/height client-side from the loaded <img> when the doc lacks them
    // (legacy rows uploaded before the metadata pipeline landed).
    /** Output pixel width after the optimise pipeline. */
    width?: number
    /** Output pixel height after the optimise pipeline. */
    height?: number
    /** Output size in bytes — mirrors `size`, named to match the upload pipeline. */
    sizeBytes?: number
    /** User id / email of the uploading session, when known. */
    uploadedBy?: string
    /** Upload timestamp (ISO string) — `created` stays the legacy date string. */
    uploadedAt?: string
    /**
     * Centralised alt text for the image (a11y). Historically alt lived only
     * on the per-section usage, so the same image had a different alt in every
     * section — an a11y regression risk. The picker edits this; persistence is
     * client-side (localStorage override store) until a `updateImage` GraphQL
     * mutation lands. Optional so legacy docs stay valid.
     */
    alt?: string
    /**
     * Number of places this image is referenced (pages / sections / posts /
     * logo / footer / siteSeo / themes). Populated by
     * `AssetService.listImagesWithUsage()`; absent on the plain `getImages`
     * path. Drives the picker's "unused" sort + usage-count info row.
     */
    usageCount?: number
}
export interface InImage {
    created: string;
    id: string;
    location: string;
    name: string;
    size: number;
    tags: InputMaybe<InputMaybe<string>[]> | undefined;
    type: string;
}
export default IImage