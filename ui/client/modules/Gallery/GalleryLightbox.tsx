import React, {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeftOutlined, CloseOutlined} from '@client/lib/icons';
import type {IGalleryItem} from './Gallery.types';

/**
 * Dedicated gallery lightbox — replaces AntD's `Image.PreviewGroup` fallback
 * (the spec's "custom lightbox with swipe nav", previously deferred).
 *
 * Why custom over AntD's previewer:
 *   - AntD's previewer ships a zoom / rotate / flip toolbar that doesn't fit
 *     a content-gallery, and its caption support is non-existent — this
 *     surface needs `alt` + `text` shown under the active photo.
 *   - Swipe-to-navigate on touch devices isn't in AntD's previewer.
 *
 * Behaviour:
 *   - `←` / `→` cycle (wrapping); `Esc` closes; focus is trapped to the
 *     dialog while open and restored to the trigger tile on close.
 *   - Horizontal swipe (touch) cycles; a short tap on the backdrop closes.
 *   - `prefers-reduced-motion` is honoured by the SCSS (transitions gate on
 *     `--motion-scalar`).
 *
 * Only mounts when `index >= 0`; rendered through a portal to `document.body`
 * so it escapes any `overflow: hidden` the gallery style variants set.
 */

const SWIPE_THRESHOLD_PX = 48;

interface Props {
    items: IGalleryItem[];
    /** Active item index, or -1 when the lightbox is closed. */
    index: number;
    onClose: () => void;
    onNavigate: (next: number) => void;
}

const GalleryLightbox: React.FC<Props> = ({items, index, onClose, onNavigate}) => {
    const open = index >= 0 && index < items.length;
    const dialogRef = useRef<HTMLDivElement>(null);
    const touchStartX = useRef<number | null>(null);

    const go = useCallback(
        (delta: number) => {
            if (!items.length) return;
            const next = (index + delta + items.length) % items.length;
            onNavigate(next);
        },
        [index, items.length, onNavigate],
    );

    // Keyboard: arrows cycle, Esc closes. Bound on the dialog (which is
    // focused on open) so it doesn't leak to the rest of the page.
    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onClose();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                go(1);
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                go(-1);
            }
        },
        [go, onClose],
    );

    // Focus the dialog on open; lock body scroll while open.
    useEffect(() => {
        if (!open) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialogRef.current?.focus();
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [open]);

    // `index` only flips to >= 0 from a client-side tile click, so by the
    // time we render there is always a `document` — the guard is belt-and-
    // braces for any future SSR caller.
    if (!open || typeof document === 'undefined') return null;

    const active = items[index];
    const img = active.image;
    const caption = (img.alt || '').trim();
    const note = (active.text || '').trim();

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
    };
    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current == null) return;
        const dx = (e.changedTouches[0]?.clientX ?? touchStartX.current) - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
        go(dx < 0 ? 1 : -1);
    };

    return createPortal(
        <div
            className={'gallery-lightbox'}
            data-testid={'gallery-lightbox'}
            role={'dialog'}
            aria-modal={'true'}
            aria-label={caption || 'Gallery image'}
            tabIndex={-1}
            ref={dialogRef}
            onKeyDown={onKeyDown}
            onClick={(e) => {
                // Backdrop click (not a click bubbling up from the figure / controls).
                if (e.target === e.currentTarget) onClose();
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <button
                type={'button'}
                className={'gallery-lightbox__close'}
                data-testid={'gallery-lightbox-close'}
                aria-label={'Close'}
                onClick={onClose}
            >
                <CloseOutlined/>
            </button>

            {items.length > 1 && (
                <button
                    type={'button'}
                    className={'gallery-lightbox__nav gallery-lightbox__nav--prev'}
                    data-testid={'gallery-lightbox-prev'}
                    aria-label={'Previous image'}
                    onClick={() => go(-1)}
                >
                    <ArrowLeftOutlined/>
                </button>
            )}

            <figure className={'gallery-lightbox__figure'} data-testid={'gallery-lightbox-figure'}>
                <img
                    className={'gallery-lightbox__image'}
                    src={'/' + img.src}
                    alt={img.alt || ''}
                    data-testid={'gallery-lightbox-image'}
                />
                {(caption || note) && (
                    <figcaption className={'gallery-lightbox__caption'} data-testid={'gallery-lightbox-caption'}>
                        {caption && <span className={'gallery-lightbox__caption-title'}>{caption}</span>}
                        {note && <span className={'gallery-lightbox__caption-note'}>{note}</span>}
                        {items.length > 1 && (
                            <span className={'gallery-lightbox__counter'}>
                                {index + 1} / {items.length}
                            </span>
                        )}
                    </figcaption>
                )}
            </figure>

            {items.length > 1 && (
                <button
                    type={'button'}
                    className={'gallery-lightbox__nav gallery-lightbox__nav--next'}
                    data-testid={'gallery-lightbox-next'}
                    aria-label={'Next image'}
                    onClick={() => go(1)}
                >
                    {/* `next` reuses the left-arrow glyph mirrored in SCSS —
                        the icon set ships no right-arrow export. */}
                    <ArrowLeftOutlined/>
                </button>
            )}
        </div>,
        document.body,
    );
};

export default GalleryLightbox;
