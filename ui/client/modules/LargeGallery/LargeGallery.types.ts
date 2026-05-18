import {IImageRef} from "@interfaces/IImageRef";

/**
 * `LargeGallery` — image-led layout used by the `Premium` / `Lookbook`
 * product display templates. Renders a full-bleed grid on desktop, a
 * horizontal carousel on phones. Phase 1.F (product-display-templates).
 */
export interface ILargeGallery {
    /** Optional title rendered above the gallery. */
    title?: string;
    /** Explicit image list — when omitted, the renderer pulls
     *  `product.images` from `ProductContext`. */
    images?: IImageRef[];
}

export enum ELargeGalleryStyle {
    Default = "default",
    /** First image full-bleed, rest in a smaller grid below. */
    Hero = "hero",
    /** 16:9 cinematic letterbox single row. */
    Cinema = "cinema",
    /** Rotated polaroid tiles with white borders. */
    Polaroid = "polaroid",
}
