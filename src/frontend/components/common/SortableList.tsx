import React, {useMemo} from 'react';
import {
    DndContext,
    DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

/**
 * Drag-to-reorder list with **explicit drag handles**. Different from
 * `DraggableWrapper` which spreads the drag listeners on the whole item
 * wrapper — that's right for content sections (they don't have child
 * inputs) but wrong for inline form lists where every row hosts <Input>
 * elements that need to receive their own click / focus events.
 *
 * Each row is wrapped in a `<SortableHandleItem>` that exposes a small
 * left-side `≡` grip; only the grip carries `useSortable.listeners`, so
 * clicks anywhere else in the row land on the underlying Input as
 * expected. Form interactions and DnD coexist.
 *
 * The list is keyed by stable item ids the caller supplies; if the
 * underlying data has no natural id, pass `${index}` and accept that the
 * activation-distance sensor still prevents accidental click→drag
 * transitions when items shuffle. Re-rendering with new ids causes
 * `<DndContext>` to re-mount its internal state, which is the right thing
 * for "clear on save" patterns.
 *
 * `onReorder(from, to)` is called once per drop with the original and
 * landing indexes (suitable for `arrayMove(items, from, to)`); the
 * `arrayMove` helper is also re-exported here so callers don't need a
 * second import from `@dnd-kit/sortable`.
 */

export {arrayMove};

interface SortableListProps {
    ids: string[];
    onReorder: (from: number, to: number) => void;
    children: React.ReactNode;
    /** Skip the DnD wrapper entirely when not in admin mode. */
    enabled?: boolean;
}

export const SortableList: React.FC<SortableListProps> = ({ids, onReorder, children, enabled = true}) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 4}}),
        useSensor(TouchSensor, {activationConstraint: {delay: 200, tolerance: 5}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
    );

    if (!enabled) return <>{children}</>;

    const handleDragEnd = (event: DragEndEvent) => {
        if (!event.over || event.active.id === event.over.id) return;
        const from = ids.indexOf(String(event.active.id));
        const to = ids.indexOf(String(event.over.id));
        if (from === -1 || to === -1 || from === to) return;
        onReorder(from, to);
    };

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {children}
            </SortableContext>
        </DndContext>
    );
};

/**
 * Single row inside a `<SortableList>`. Renders the children inline
 * after a small left-side grip handle — only the grip is the drag
 * source so the rest of the row stays interactive.
 */
export const SortableHandleItem: React.FC<{
    id: string;
    children: React.ReactNode;
    className?: string;
}> = ({id, children, className}) => {
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id});
    const style = useMemo<React.CSSProperties>(() => ({
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        // The handle lives in this row so it wants its own touch isolation,
        // not a list-wide `touch-action: none` that would block the inputs.
    }), [transform, transition, isDragging]);
    return (
        <div ref={setNodeRef} style={style} className={className}>
            <span
                {...attributes}
                {...listeners}
                aria-label="Drag to reorder"
                style={{
                    cursor: 'grab',
                    padding: '6px 4px',
                    color: '#999',
                    userSelect: 'none',
                    fontSize: 16,
                    lineHeight: 1,
                    touchAction: 'none',
                }}
            >
                ≡
            </span>
            <div style={{flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 6}}>
                {children}
            </div>
        </div>
    );
};

export default SortableList;
