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
    Default = "default",
}
