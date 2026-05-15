import React, {useEffect, useState} from 'react';
import type {InlineEditHoverState} from './useInlineEdit';

/**
 * Hover affordance — renders a position:fixed outline + a small pill
 * labelling the field, tracking the hovered element via its
 * `getBoundingClientRect()`. Re-measures on `scroll` / `resize` so the
 * outline follows during page scroll.
 *
 * Kept as a separate component so it can be lazy-rendered (only when a
 * hovered element exists) — avoids a permanent always-mounted overlay
 * that catches paint cycles.
 */

const REPAINT_THROTTLE_MS = 16;

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

function readRect(el: HTMLElement): Rect {
    const r = el.getBoundingClientRect();
    return {top: r.top, left: r.left, width: r.width, height: r.height};
}

export const InlineEditHighlight: React.FC<{hovered: InlineEditHoverState | undefined}> = ({hovered}) => {
    const [rect, setRect] = useState<Rect | undefined>(undefined);

    useEffect(() => {
        if (!hovered) {
            // Deferred to dodge the lint rule banning synchronous
            // setState-in-useEffect; the next paint cycle is fine for
            // tearing down the outline.
            const clearTimer = window.setTimeout(() => setRect(undefined), 0);
            return () => window.clearTimeout(clearTimer);
        }
        let raf = 0;
        const tick = () => {
            raf = 0;
            setRect(readRect(hovered.element));
        };
        const schedule = () => {
            if (raf) return;
            raf = window.setTimeout(tick, REPAINT_THROTTLE_MS);
        };
        // Initial measurement is deferred by one tick so the lint rule
        // banning synchronous setState-in-useEffect is honoured — the
        // outline appears within ~16ms anyway, indistinguishable.
        schedule();
        window.addEventListener('scroll', schedule, true);
        window.addEventListener('resize', schedule);
        return () => {
            window.removeEventListener('scroll', schedule, true);
            window.removeEventListener('resize', schedule);
            if (raf) window.clearTimeout(raf);
        };
    }, [hovered]);

    if (!hovered || !rect) return null;

    return (
        <div
            className="inline-edit-overlay__highlight"
            data-testid="inline-edit-highlight"
            style={{
                position: 'fixed',
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                pointerEvents: 'none',
                zIndex: 1500,
            }}
        >
            <div className="inline-edit-overlay__pill" data-testid="inline-edit-highlight-pill">
                {hovered.target.collection}/{hovered.target.field}
            </div>
        </div>
    );
};

export default InlineEditHighlight;
