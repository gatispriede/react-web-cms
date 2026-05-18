import {ETextPosition} from "@enums/ETextPosition";
import {IImageRef} from "@interfaces/IImageRef";
import {ILinkRef} from "@interfaces/ILinkRef";

export interface IGalleryItem {
    image: IImageRef;
    preview: boolean;
    text: string;
    textPosition: ETextPosition;
    /** Optional tile target — renders the tile as an anchor linking here. */
    link?: ILinkRef;
}

/** Pre-C18 stored shape — read-side fallback only. */
export interface IGalleryItemLegacy {
    alt?: string;
    height?: number;
    preview?: boolean;
    src?: string;
    text?: string;
    imgWidth?: string;
    imgHeight?: string;
    textPosition?: ETextPosition;
    href?: string;
    image?: IImageRef;
    link?: ILinkRef;
}

export type GalleryAspectRatio = 'free' | '1:1' | '4:3' | '3:2' | '16:9';

export const GALLERY_ASPECT_RATIOS: GalleryAspectRatio[] = ['free', '1:1', '4:3', '3:2', '16:9'];

export interface IGallery {
    items: IGalleryItem[];
    disablePreview: boolean;
    aspectRatio?: GalleryAspectRatio;
    /**
     * When `true` (the default), captions render the item's `alt` text as the
     * primary label with `text` as an optional secondary line. When `false`,
     * only the explicit `text` shows — the legacy behaviour. Lets operators
     * opt out of alt-as-caption for galleries where alt is purely a11y noise.
     */
    showCaptions?: boolean;
}

export enum EGalleryStyle {
    Default = "default",
    Marquee = "marquee",
    LogoWall = "logo-wall",
    HazardStrip = "hazard-strip",
    Masonry = "masonry",
    Polaroid = "polaroid",
    Mosaic = "mosaic",
    Cinema = "cinema",
}
