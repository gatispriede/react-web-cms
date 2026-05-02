import React from 'react';

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'width' | 'height'> {
    src: string;
    alt?: string;
    /** Author-supplied width — number → px, string passed through (e.g. '24px', '100%'). */
    width?: number | string;
    /** Same rules as `width`. */
    height?: number | string;
}

/**
 * Renders an `<img>` that respects author-supplied `width` / `height` even when
 * the surrounding theme CSS contains a blanket rule (`.logo img { height: 40px }`,
 * `.gallery img { width: 100% }`, …). When either dimension is provided, we:
 *   - set the matching HTML attribute (browser aspect-ratio reserve), and
 *   - mirror it to inline `style.maxWidth` / `style.height` so the theme's CSS
 *     can be carved out via `:not([data-sized])` without losing browser-level
 *     aspect-ratio reservation, and
 *   - emit `data-sized="true"` so the SCSS carve-outs can target this case.
 *
 * If both dimensions are empty, behaves identically to a bare `<img>` so
 * existing layouts are unaffected (responsive fill via parent CSS still wins).
 *
 * See `docs/roadmap/image-width-height-respect.md` (C12) for the broader sweep.
 */
const SizedImage: React.FC<Props> = ({src, alt, width, height, style, ...rest}) => {
    const hasW = width !== undefined && width !== '' && width !== 0;
    const hasH = height !== undefined && height !== '' && height !== 0;
    const sized = hasW || hasH;

    const inline: React.CSSProperties = {...style};
    if (hasW) inline.maxWidth = typeof width === 'number' ? `${width}px` : (width as string);
    if (hasH) inline.height = typeof height === 'number' ? `${height}px` : (height as string);

    const widthAttr = hasW && typeof width === 'number' ? width : undefined;
    const heightAttr = hasH && typeof height === 'number' ? height : undefined;

    return (
        <img
            src={src}
            alt={alt ?? ''}
            width={widthAttr}
            height={heightAttr}
            data-sized={sized || undefined}
            style={inline}
            {...rest}
        />
    );
};

export default SizedImage;
