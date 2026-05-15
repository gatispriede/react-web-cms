import React, {useCallback, useRef, useState} from 'react';
import type {BeforeAfterSliderProps} from './BeforeAfterSlider.types';

function clamp(v: number): number {
    return Math.max(0, Math.min(100, v));
}

const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
    testId,
    beforeUrl,
    beforeAlt,
    afterUrl,
    afterAlt,
    initialPercent = 50,
    beforeLabel,
    afterLabel,
}) => {
    const [percent, setPercent] = useState<number>(clamp(initialPercent));
    const containerRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef<boolean>(false);

    const updateFromClientX = useCallback((clientX: number) => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0) return;
        const next = ((clientX - rect.left) / rect.width) * 100;
        setPercent(clamp(next));
    }, []);

    const onPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        draggingRef.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromClientX(e.clientX);
    }, [updateFromClientX]);

    const onPointerMove = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        if (!draggingRef.current) return;
        updateFromClientX(e.clientX);
    }, [updateFromClientX]);

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
        draggingRef.current = false;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    }, []);

    const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setPercent(p => clamp(p - 5));
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setPercent(p => clamp(p + 5));
        }
    }, []);

    return (
        <div
            ref={containerRef}
            className="before-after-slider"
            data-testid={testId}
            style={{['--percent' as string]: `${percent}%`} as React.CSSProperties}
        >
            <img
                className="before-after-slider__img before-after-slider__img--before"
                data-testid={`${testId}-before`}
                src={beforeUrl}
                alt={beforeAlt}
            />
            <img
                className="before-after-slider__img before-after-slider__img--after"
                data-testid={`${testId}-after`}
                src={afterUrl}
                alt={afterAlt}
            />
            {beforeLabel ? (
                <span className="before-after-slider__label before-after-slider__label--before">{beforeLabel}</span>
            ) : null}
            {afterLabel ? (
                <span className="before-after-slider__label before-after-slider__label--after">{afterLabel}</span>
            ) : null}
            <button
                type="button"
                className="before-after-slider__handle"
                data-testid={`${testId}-handle`}
                aria-label="Reveal slider"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent)}
                role="slider"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onKeyDown}
            />
            <span
                className="before-after-slider__percent"
                data-testid={`${testId}-percent`}
                data-percent={Math.round(percent)}
                aria-hidden
            />
        </div>
    );
};

export default BeforeAfterSlider;
export {BeforeAfterSlider};
