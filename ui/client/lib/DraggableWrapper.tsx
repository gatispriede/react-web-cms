import React, {useMemo, useState} from "react";
import {
    DndContext,
    DragEndEvent,
    DragOverEvent,
    DragStartEvent,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";

interface IDraggableWrapper {
    admin: boolean;
    children: React.ReactNode;
    id: string;
    onPosChange: (oldIndex: number, newIndex: number) => void;
}

/**
 * Sortable list wrapper. Drags any child by its top-level handle, animates
 * the rest into position via @dnd-kit's `verticalListSortingStrategy`, and
 * fires `onPosChange(from, to)` on commit. Three sensors so editors can
 * drive the same list from a mouse, an iPad, or a keyboard:
 *
 *   • PointerSensor — 8 px activation distance so a click on a button
 *     inside a section doesn't accidentally start a drag.
 *   • TouchSensor — 250 ms hold + 5 px tolerance so scrolling on iPad
 *     doesn't get hijacked.
 *   • KeyboardSensor — `space` to grab, arrow keys to move, `space` to drop.
 *
 * Auto-scroll near the viewport edges is enabled by `<DndContext>` defaults.
 *
 * The pulsing accent drop-indicator (kept from the previous native-HTML5
 * incarnation, see `.section-drop-indicator` in `styles/globals/global.scss`) renders
 * at the gap above whatever section the cursor is hovering over — explicit
 * "this is where it lands" cue on top of the implicit shift the sortable
 * strategy already provides. Suppressed when hovering the dragged item
 * itself so the indicator doesn't appear in front of the source slot.
 *
 * `id` (the prop, not the dnd-kit IDs) is used as the React key on the
 * non-admin path so the list rerenders when the upstream caller resets it.
 */
const DraggableWrapper: React.FC<IDraggableWrapper> = ({admin, children, id, onPosChange}) => {
    const items = React.Children.toArray(children);
    const sortableIds = useMemo(() => items.map((_, i) => `dnd-${i}`), [items.length]);

    const [activeId, setActiveId] = useState<string | null>(null);
    const [overId, setOverId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {activationConstraint: {distance: 8}}),
        useSensor(TouchSensor, {activationConstraint: {delay: 250, tolerance: 5}}),
        useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}),
    );

    if (!admin) {
        return <div key={id}>{children}</div>;
    }

    const indexOf = (sortableId: string | null): number | null => {
        if (!sortableId) return null;
        const i = sortableIds.indexOf(sortableId);
        return i >= 0 ? i : null;
    };

    const activeIndex = indexOf(activeId);
    const overIndex = indexOf(overId);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(String(event.active.id));
    };

    const handleDragOver = (event: DragOverEvent) => {
        setOverId(event.over ? String(event.over.id) : null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        setOverId(null);
        const from = indexOf(String(event.active.id));
        const to = event.over ? indexOf(String(event.over.id)) : null;
        if (from === null || to === null || from === to) return;
        onPosChange(from, to);
    };

    const handleDragCancel = () => {
        setActiveId(null);
        setOverId(null);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
        >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                <div className="dnd-list" key={id}>
                    {items.map((child, i) => {
                        const showIndicatorAbove =
                            overIndex !== null &&
                            activeIndex !== null &&
                            overIndex === i &&
                            overIndex !== activeIndex;
                        return (
                            <React.Fragment key={sortableIds[i]}>
                                {showIndicatorAbove && <div className="section-drop-indicator"/>}
                                <SortableItem id={sortableIds[i]}>
                                    {child}
                                </SortableItem>
                            </React.Fragment>
                        );
                    })}
                </div>
            </SortableContext>
        </DndContext>
    );
};

const SortableItem: React.FC<{id: string; children: React.ReactNode}> = ({id, children}) => {
    const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id});
    // Compose dnd-kit's translate transform with the legacy `.is-dragging`
    // scale (handled in SCSS) — passing `transform` straight from CSS.Transform
    // would drop the scale because they share the inline `transform` channel.
    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        // Let the user-agent pass the touch event through to dnd-kit instead
        // of starting a native page-scroll that would compete with our sensor.
        touchAction: 'none',
    };
    // Guard listeners so they only act when the event originates from the
    // wrapper itself (or non-editable descendants). The AntD edit Drawer
    // portals its DOM elsewhere, but React's synthetic events still bubble
    // through the React tree — so a Space press inside a Hero headline
    // `<Input>` was reaching dnd-kit's KeyboardSensor, which treats Space
    // as "grab the item" and `preventDefault`s it. Net effect: space key
    // never reaches text inputs anywhere inside a sortable section.
    const isFormElement = (target: EventTarget | null): boolean => {
        const el = target as HTMLElement | null;
        if (!el) return false;
        const tag = el.tagName?.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
        if (el.isContentEditable) return true;
        // AntD selects / autocompletes render their actual focusable node as
        // a div with `role="combobox"` or `role="textbox"`; treat those as
        // form elements too so the handler yields on typing.
        const role = el.getAttribute?.('role');
        if (role === 'combobox' || role === 'textbox' || role === 'searchbox') return true;
        return false;
    };
    const guardedListeners = listeners ? Object.fromEntries(
        Object.entries(listeners).map(([name, handler]) => [
            name,
            (e: any) => {
                if (isFormElement(e?.target)) return;
                (handler as (ev: any) => void)(e);
            },
        ]),
    ) : undefined;
    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`dnd-item${isDragging ? ' is-dragging' : ''}`}
            {...attributes}
            {...guardedListeners}
        >
            {children}
        </div>
    );
};

export default DraggableWrapper;
