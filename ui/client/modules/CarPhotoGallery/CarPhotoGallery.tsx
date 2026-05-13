import React, {useCallback, useRef, useState} from 'react';
import type {CarPhotoGalleryProps} from './CarPhotoGallery.types';
import './CarPhotoGallery.scss';

const CarPhotoGallery: React.FC<CarPhotoGalleryProps> = ({
    testId,
    photos,
    initialIndex = 0,
    ariaLabel = 'Vehicle photo gallery',
}) => {
    const total = photos.length;
    const safeInitial = total > 0 ? Math.min(Math.max(initialIndex, 0), total - 1) : 0;
    const [rawIndex, setIndex] = useState<number>(safeInitial);
    const containerRef = useRef<HTMLDivElement | null>(null);
    // Clamp on every render so a shrunken photos list never points past the end.
    const index = total > 0 ? Math.min(rawIndex, total - 1) : 0;

    const goPrev = useCallback(() => {
        setIndex(i => Math.max(0, i - 1));
    }, []);

    const goNext = useCallback(() => {
        setIndex(i => Math.min(total - 1, i + 1));
    }, [total]);

    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goPrev();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            goNext();
        }
    }, [goPrev, goNext]);

    if (total === 0) return null;

    const current = photos[index];
    const isFirst = index === 0;
    const isLast = index === total - 1;

    return (
        <section
            ref={containerRef}
            className="car-photo-gallery"
            data-testid={testId}
            role="region"
            aria-label={ariaLabel}
            tabIndex={0}
            onKeyDown={onKeyDown}
        >
            <div className="car-photo-gallery__hero-wrap">
                <img
                    key={current.url}
                    className="car-photo-gallery__hero"
                    data-testid={`${testId}-hero`}
                    src={current.url}
                    alt={current.alt}
                    loading={index > 2 ? 'lazy' : 'eager'}
                />
                {!isFirst && (
                    <button
                        type="button"
                        className="car-photo-gallery__nav car-photo-gallery__nav--prev"
                        data-testid={`${testId}-prev`}
                        aria-label="Previous photo"
                        onClick={goPrev}
                    >‹</button>
                )}
                {!isLast && (
                    <button
                        type="button"
                        className="car-photo-gallery__nav car-photo-gallery__nav--next"
                        data-testid={`${testId}-next`}
                        aria-label="Next photo"
                        onClick={goNext}
                    >›</button>
                )}
                <span
                    className="car-photo-gallery__count"
                    data-testid={`${testId}-count`}
                >{`${index + 1} / ${total}`}</span>
            </div>
            <ul className="car-photo-gallery__thumbs" role="list">
                {photos.map((photo, i) => {
                    const active = i === index;
                    return (
                        <li key={photo.url} className="car-photo-gallery__thumb-item">
                            <button
                                type="button"
                                className={`car-photo-gallery__thumb${active ? ' is-active' : ''}`}
                                data-testid={`${testId}-thumb-${i}`}
                                aria-current={active ? 'true' : undefined}
                                aria-label={`Show photo ${i + 1}`}
                                onClick={() => setIndex(i)}
                            >
                                <img
                                    className="car-photo-gallery__thumb-img"
                                    src={photo.url}
                                    alt=""
                                    loading={i > 2 ? 'lazy' : 'eager'}
                                />
                            </button>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
};

export default CarPhotoGallery;
export {CarPhotoGallery};
