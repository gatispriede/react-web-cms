import {ETextPosition} from "@enums/ETextPosition";

export interface IGalleryItem {
    alt: string;
    height: number;
    preview: boolean;
    src: string;
    text: string;
    imgWidth: string;
    imgHeight: string;
    textPosition: ETextPosition;
    /** Optional tile target — renders the tile as an anchor linking here. */
    href?: string;
}

/**
 * Gallery-level aspect-ratio lock. Applies uniformly to every tile's image
 * slot via CSS (`aspect-ratio: …; object-fit: cover`). `free` skips the lock
 * so tiles use their natural intrinsic ratio — matches historical behaviour.
 */
export type GalleryAspectRatio = 'free' | '1:1' | '4:3' | '3:2' | '16:9';

export const GALLERY_ASPECT_RATIOS: GalleryAspectRatio[] = ['free', '1:1', '4:3', '3:2', '16:9'];

export interface IGallery {
    items: IGalleryItem[];
    disablePreview: boolean;
    /** Optional per-gallery ratio lock — see `GalleryAspectRatio`. */
    aspectRatio?: GalleryAspectRatio;
}

export enum EGalleryStyle {
    Default = "default",
    /** Infinite horizontal scroll strip (design-v2 marquee).
     *  Pauses on hover; duplicates items once via CSS to hide the wrap-seam. */
    Marquee = "marquee",
    /** Logo-wall variant — same marquee animation, no image text captions. */
    LogoWall = "logo-wall",
    /** Thin top-bar hazard-strip ticker (design-v4 Industrial) — accent-bg,
     *  uppercase labels with bullet dots. Uses the `text` field; `src` ignored. */
    HazardStrip = "hazard-strip",
    /** Portrait+landscape-mixed CSS-columns masonry. No JS layout engine —
     *  break-inside: avoid keeps tiles intact while natural heights vary. */
    Masonry = "masonry",
}
