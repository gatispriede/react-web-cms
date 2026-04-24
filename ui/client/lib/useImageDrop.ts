import {DragEvent, useState, useCallback} from 'react';

/**
 * Tiny native-HTML5 drop target for images dragged out of the `ImageRail`.
 *
 * Native DnD (vs. dnd-kit) because the rail lives at `AdminApp` level but
 * the drop targets are buried inside section config editors — each wrapped
 * in its own `DndContext` (see `DraggableWrapper` / `SortableList`). A
 * dnd-kit drag started in the rail wouldn't reach a droppable in a
 * different context. Native `dataTransfer` cuts across every tree.
 *
 * Payload is always a JSON string with `{name, location, id}` — the
 * `name` is what the existing click-pick flow uses to build stored `src`
 * (`api/${name}`), preserved so we don't trip different persistence paths
 * between drag and click.
 *
 * Usage:
 *   const {dropHandlers, isDragOver} = useImageDrop(({name, location}) => { ... });
 *   <div {...dropHandlers} className={isDragOver ? 'drop-hover' : ''}>...</div>
 */
export const IMAGE_DRAG_MIME = 'application/x-cms-image';

export interface ImageDropPayload {
    name: string;
    location?: string;
    id?: string;
}

export function serialiseImageForDrag(evt: DragEvent, payload: ImageDropPayload): void {
    try {
        evt.dataTransfer.setData(IMAGE_DRAG_MIME, JSON.stringify(payload));
        evt.dataTransfer.effectAllowed = 'copy';
    } catch { /* noop — some sandboxed contexts refuse dataTransfer */ }
}

function parseImagePayload(evt: DragEvent): ImageDropPayload | null {
    try {
        const raw = evt.dataTransfer.getData(IMAGE_DRAG_MIME);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.name === 'string') return parsed as ImageDropPayload;
        return null;
    } catch { return null; }
}

export function useImageDrop(onDrop: (img: ImageDropPayload) => void) {
    const [isDragOver, setIsDragOver] = useState(false);

    const onDragEnter = useCallback((evt: DragEvent) => {
        if (!evt.dataTransfer.types.includes(IMAGE_DRAG_MIME)) return;
        evt.preventDefault();
        setIsDragOver(true);
    }, []);

    const onDragOver = useCallback((evt: DragEvent) => {
        // Only accept our own payload, not arbitrary browser drags (e.g.
        // text selections, files from the desktop). `types.includes` is
        // the only reliable check during `dragover` — `getData` returns ''
        // per spec until `drop`.
        if (!evt.dataTransfer.types.includes(IMAGE_DRAG_MIME)) return;
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
    }, []);

    const onDragLeave = useCallback(() => setIsDragOver(false), []);

    const handleDrop = useCallback((evt: DragEvent) => {
        setIsDragOver(false);
        const payload = parseImagePayload(evt);
        if (!payload) return;
        evt.preventDefault();
        evt.stopPropagation();
        onDrop(payload);
    }, [onDrop]);

    return {
        isDragOver,
        dropHandlers: {
            onDragEnter,
            onDragOver,
            onDragLeave,
            onDrop: handleDrop,
        },
    };
}
