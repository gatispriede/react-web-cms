import React, {useCallback, useRef, useState} from "react";

interface IDraggableWrapper {
    admin: boolean;
    children: React.ReactNode;
    id: string;
    onPosChange: (oldIndex: number, newIndex: number) => void;
}

/**
 * Simple native-HTML5 drag-and-drop list with **visible drop placeholder**.
 *
 * Previous incarnation relied on `react-drag-reorder`, which moved items
 * instantly without any indication of where they'd land — making long
 * re-orders feel like guesswork. This version:
 *
 *   1. Wraps every child in a draggable shell (admin only).
 *   2. Tracks the currently dragged index and the hovered "target" slot.
 *   3. Renders an accent-coloured gap (`.section-drop-indicator`) at the
 *      target position so you can see where the drop will land.
 *   4. Emits `onPosChange(from, to)` on drop; the parent persists + refetches.
 *
 * Non-admin view is the same flat list — zero drag overhead.
 */
const DraggableWrapper: React.FC<IDraggableWrapper> = ({admin, children, id, onPosChange}) => {
    const items = React.Children.toArray(children);
    const [dragging, setDragging] = useState<number | null>(null);
    // Target gap index — `i` means "drop before item i"; `items.length` = drop at end.
    const [target, setTarget] = useState<number | null>(null);
    // Avoid flicker when the pointer brushes multiple elements in one frame.
    const rafRef = useRef<number | null>(null);

    const handleDragStart = useCallback((index: number) => (e: React.DragEvent<HTMLDivElement>) => {
        setDragging(index);
        // Firefox requires dataTransfer to be set; the actual value doesn't matter.
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(index)); } catch { /* noop */ }
    }, []);

    const handleDragOver = useCallback((index: number) => (e: React.DragEvent<HTMLDivElement>) => {
        if (dragging === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        // Drop goes *before* index if the pointer is on the top half, else *after*.
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const isBefore = (e.clientY - rect.top) < rect.height / 2;
        const next = isBefore ? index : index + 1;
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => setTarget(next));
    }, [dragging]);

    const handleDragLeaveList = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        // Only clear when the pointer actually exits the list bounds — each
        // interior dragleave fires as we cross child borders which would
        // otherwise cause a flicker.
        const listEl = e.currentTarget as HTMLDivElement;
        const nextTarget = e.relatedTarget as Node | null;
        if (nextTarget && listEl.contains(nextTarget)) return;
        setTarget(null);
    }, []);

    const commitDrop = useCallback(() => {
        const from = dragging;
        const to = target;
        setDragging(null);
        setTarget(null);
        if (from === null || to === null) return;
        // `to` is the gap index; after removing the dragged item, the insertion
        // index shifts by one when the destination is below the source.
        let insertAt = to;
        if (to > from) insertAt = to - 1;
        if (insertAt === from) return;
        onPosChange(from, insertAt);
    }, [dragging, target, onPosChange]);

    if (!admin) {
        return <div key={id}>{children}</div>;
    }

    return (
        <div
            key={id}
            className="dnd-list"
            onDragLeave={handleDragLeaveList}
            onDrop={commitDrop}
            onDragOver={(e) => {
                // Allow drops even when the pointer is in the gutter between items.
                if (dragging !== null) e.preventDefault();
            }}
        >
            {items.map((child, i) => (
                <React.Fragment key={i}>
                    {target === i && dragging !== null && dragging !== i && <div className="section-drop-indicator"/>}
                    <div
                        className={`dnd-item${dragging === i ? ' is-dragging' : ''}`}
                        draggable
                        onDragStart={handleDragStart(i)}
                        onDragOver={handleDragOver(i)}
                        onDragEnd={() => { setDragging(null); setTarget(null); }}
                    >
                        {child}
                    </div>
                </React.Fragment>
            ))}
            {target === items.length && dragging !== null && <div className="section-drop-indicator"/>}
        </div>
    );
};

export default DraggableWrapper;
