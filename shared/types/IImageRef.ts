export interface IImageRef {
    src: string;
    alt?: string;
    width?: string | number;
    height?: string | number;
}

export const EMPTY_IMAGE_REF: IImageRef = {src: ''};

/**
 * Normalise legacy image fields to {@link IImageRef}. Older module JSON
 * scattered the same intent across `src` / `imgWidth` / `imgHeight` / `alt`
 * (PlainImage, GalleryItem) or carried a bare string (Hero `bgImage`,
 * ProjectCard `image`). The legacy shape is read-tolerant — the new shape is
 * the only thing emitted on save.
 */
export function toImageRef(input: unknown, legacy?: {
    src?: string;
    alt?: string;
    width?: string | number;
    height?: string | number;
}): IImageRef {
    if (input && typeof input === 'object' && 'src' in (input as Record<string, unknown>)) {
        const obj = input as Record<string, unknown>;
        const ref: IImageRef = {src: typeof obj.src === 'string' ? obj.src : ''};
        if (typeof obj.alt === 'string' && obj.alt) ref.alt = obj.alt;
        if (obj.width !== undefined && obj.width !== '' && obj.width !== null) ref.width = obj.width as IImageRef['width'];
        if (obj.height !== undefined && obj.height !== '' && obj.height !== null) ref.height = obj.height as IImageRef['height'];
        return ref;
    }
    const src = typeof input === 'string' ? input : (legacy?.src ?? '');
    const ref: IImageRef = {src};
    if (legacy?.alt) ref.alt = legacy.alt;
    if (legacy?.width !== undefined && legacy.width !== '' && legacy.width !== null) ref.width = legacy.width;
    if (legacy?.height !== undefined && legacy.height !== '' && legacy.height !== null) ref.height = legacy.height;
    return ref;
}
