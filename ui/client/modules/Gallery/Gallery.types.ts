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
}

export interface IGallery {
    items: IGalleryItem[];
    disablePreview: boolean;
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
}
