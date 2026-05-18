export interface CarPhotoGalleryPhoto {
    url: string;
    /** Alt text per image — caller-supplied (operator-edited). */
    alt: string;
}

export interface CarPhotoGalleryProps {
    testId: string;
    photos: CarPhotoGalleryPhoto[];
    /** Initial selected index. Default 0. */
    initialIndex?: number;
    /** Operator-overridable label for the gallery role. */
    ariaLabel?: string;
}
