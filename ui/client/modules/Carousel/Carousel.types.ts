import type {IGalleryItem} from "../Gallery/Gallery.types";

export interface ICarousel {
    items: IGalleryItem[];
    autoplay: boolean;
    infinity: boolean;
    autoplaySpeed: number;
    dots: boolean;
    arrows: boolean;
    disablePreview: boolean;
}

export enum ECarouselStyle {
    /** Standard 16:9 slide with bottom gradient caption (current default). */
    Default = "default",
    /** Edge-to-edge tall crop with centered card-style caption overlay —
     *  good for hero-like image statements. */
    Cinematic = "cinematic",
    /** Polaroid — white frame + caption printed below the image tile,
     *  slight rotation on inactive slides for a casual photo-wall feel. */
    Polaroid = "polaroid",
    /** Thin ribbon strip — 21:9 crop, minimal chrome, for interstitial
     *  rhythm between text-heavy sections. */
    Ribbon = "ribbon",
    /** Editorial — square crop, large sans caption block on the right
     *  with a mono attribution line underneath. */
    Editorial = "editorial",
    /** Coverflow — perspective tilt on side slides (rotateY), center slide
     *  flat. Slides look like album art on a turntable carousel. */
    Coverflow = "coverflow",
    /** Cinema — 16:9 dark letterbox frame with dimmed non-active slides;
     *  active slide pops out of a near-black surround. */
    Cinema = "cinema",
    /** Cards — peek of next/prev card with rounded corners + heavy shadow
     *  for a deck-of-cards feel; active slide elevated. */
    Cards = "cards",
}
