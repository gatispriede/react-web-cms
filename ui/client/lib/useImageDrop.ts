import {DragEvent, useState, useCallback, useRef} from 'react';

/**
 * Native-HTML5 drop target for images — supports three sources:
 *
 *   1. **Internal picker drag** (`application/x-cms-image`) — a tile dragged
 *      out of `ImageRail`. Payload is a JSON string with `{name, location, id}`;
 *      the `name` is what the existing click-pick flow uses to build the
 *      stored `src` (`api/${name}`), preserved so drag + click land on the
 *      same persistence path.
 *   2. **OS file drag** (`dataTransfer.files`) — desktop images dropped onto
 *      an editable module. We POST each to `/api/upload` and emit one
 *      `onDrop({name, location})` per successful file, so targets that only
 *      care about a single image behave like the picker drag and list-style
 *      targets (Gallery, Carousel) naturally append.
 *   3. **URL drag** (`text/uri-list` or `text/plain`) — a URL dragged out of
 *      another tab. We fetch the bytes, wrap in a `File`, and route through
 *      the same upload path. Declining to hotlink keeps the site in one
 *      content-policy origin + avoids breakage when the remote host moves
 *      the image.
 *
 * Native DnD (vs. dnd-kit) because the rail lives at `AdminApp` level but
 * the drop targets are buried inside section config editors — each wrapped
 * in its own `DndContext` (see `DraggableWrapper` / `SortableList`). A
 * dnd-kit drag started in the rail wouldn't reach a droppable in a
 * different context. Native `dataTransfer` cuts across every tree.
 *
 * Usage:
 *   const {dropHandlers, isDragOver, isUploading} = useImageDrop(
 *     ({name, location}) => onChange({...data, src: name}),
 *   );
 *   <div {...dropHandlers} className={isDragOver ? 'drop-hover' : ''}>...</div>
 */
export const IMAGE_DRAG_MIME = 'application/x-cms-image';

export interface ImageDropPayload {
    name: string;
    location?: string;
    id?: string;
}

export interface UseImageDropOptions {
    /** Accept OS-file drops (default `true`). Set to `false` for targets where
     *  only internal picker drags should work — e.g. edge cases where an
     *  upload-on-drop would surprise the editor. */
    acceptFiles?: boolean;
    /** Accept URL drops (default `true`). Same as above — fetches + re-hosts. */
    acceptUrls?: boolean;
    /** Optional hook fired when an upload fails so the caller can surface a
     *  toast / inline error. If omitted we log to console only. */
    onError?: (message: string) => void;
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

/** Small predicates so the dragover / drop branches read like prose. */
function hasInternalPayload(evt: DragEvent): boolean {
    return evt.dataTransfer.types.includes(IMAGE_DRAG_MIME);
}
function hasFiles(evt: DragEvent): boolean {
    return evt.dataTransfer.types.includes('Files');
}
function hasUri(evt: DragEvent): boolean {
    return evt.dataTransfer.types.includes('text/uri-list')
        || evt.dataTransfer.types.includes('text/plain');
}

const IMAGE_MIME_RE = /^image\/(png|jpe?g|gif|webp|avif|svg\+xml)$/i;

function isImageFile(file: File): boolean {
    if (file.type && IMAGE_MIME_RE.test(file.type)) return true;
    // MIME sniff can miss on some OS / drag sources — fall back to extension.
    return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.name);
}

/** POST a single File to `/api/upload`. Returns the stored image metadata
 *  (the server echoes `{fields, files, image}` on success; `image` carries
 *  `name` + `location`). Surfaces dupe / auth errors to the caller. */
async function uploadFile(file: File): Promise<ImageDropPayload> {
    const fd = new FormData();
    fd.append('file', file);
    // Tags match the click-pick flow default — an empty list so the image
    // lands in "All" only.
    fd.append('tags', '[]');
    const res = await fetch('/api/upload', {method: 'POST', body: fd});
    if (!res.ok) {
        // 403 = wrong role, 4xx/5xx = generic. Server sends text, not JSON.
        const text = await res.text().catch(() => res.statusText);
        throw new Error(text || `upload failed (${res.status})`);
    }
    // Happy path is JSON; a duplicate-name upload returns 200 with `{error: ...}`.
    const body = await res.json().catch(() => ({} as any));
    if (body?.error) throw new Error(String(body.error));
    const image = body?.image;
    if (!image?.name) throw new Error('upload succeeded but response is missing image.name');
    return {name: image.name, location: image.location, id: image.id};
}

/** Fetch a URL → wrap the bytes in a `File` we can POST through the
 *  standard upload pipeline. `no-store` because we don't want the browser
 *  to hand us a stale cached body for a URL the user just grabbed. */
async function urlToFile(url: string): Promise<File> {
    const res = await fetch(url, {cache: 'no-store'});
    if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
    const blob = await res.blob();
    if (!IMAGE_MIME_RE.test(blob.type)) {
        // Best-effort: some servers return `application/octet-stream` for
        // images. Derive from path extension so the upload still succeeds.
        const ext = (url.split('?')[0].match(/\.([a-z0-9]+)$/i)?.[1] ?? 'bin').toLowerCase();
        if (!/^(png|jpe?g|gif|webp|avif|svg)$/.test(ext)) {
            throw new Error(`URL is not an image (${blob.type || 'unknown'})`);
        }
    }
    const name = (() => {
        try {
            const u = new URL(url);
            const base = u.pathname.split('/').pop() || 'image';
            return base.includes('.') ? base : `${base}.png`;
        } catch { return `image-${Date.now()}.png`; }
    })();
    return new File([blob], name, {type: blob.type || 'image/png'});
}

export function useImageDrop(
    onDrop: (img: ImageDropPayload) => void,
    options: UseImageDropOptions = {},
) {
    const {acceptFiles = true, acceptUrls = true, onError} = options;
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    // Counter-balance `dragenter`/`dragleave` so the hover state doesn't
    // flicker when the pointer crosses a child element (each child boundary
    // fires a leave-from-parent + enter-to-child). See MDN `dragleave` notes.
    const enterDepth = useRef(0);

    const canAccept = useCallback((evt: DragEvent): boolean => {
        if (hasInternalPayload(evt)) return true;
        if (acceptFiles && hasFiles(evt)) return true;
        if (acceptUrls && hasUri(evt)) return true;
        return false;
    }, [acceptFiles, acceptUrls]);

    const onDragEnter = useCallback((evt: DragEvent) => {
        if (!canAccept(evt)) return;
        evt.preventDefault();
        enterDepth.current += 1;
        setIsDragOver(true);
    }, [canAccept]);

    const onDragOver = useCallback((evt: DragEvent) => {
        // Only accept supported drag sources — otherwise `preventDefault`
        // here would silently hijack unrelated drags (text selections etc).
        if (!canAccept(evt)) return;
        evt.preventDefault();
        evt.dataTransfer.dropEffect = 'copy';
    }, [canAccept]);

    const onDragLeave = useCallback((_evt: DragEvent) => {
        enterDepth.current = Math.max(0, enterDepth.current - 1);
        if (enterDepth.current === 0) setIsDragOver(false);
    }, []);

    const reportError = useCallback((msg: string) => {
        if (onError) onError(msg);
        else console.error('[useImageDrop]', msg);
    }, [onError]);

    const handleDrop = useCallback(async (evt: DragEvent) => {
        enterDepth.current = 0;
        setIsDragOver(false);

        // 1) Internal picker payload always wins — cheapest path, no upload.
        const payload = parseImagePayload(evt);
        if (payload) {
            evt.preventDefault();
            evt.stopPropagation();
            onDrop(payload);
            return;
        }

        // 2) Desktop file drop — upload each image then emit per-file.
        if (acceptFiles && evt.dataTransfer.files?.length) {
            evt.preventDefault();
            evt.stopPropagation();
            const files = Array.from(evt.dataTransfer.files);
            const images = files.filter(isImageFile);
            const rejected = files.length - images.length;
            if (rejected > 0) {
                reportError(`${rejected} file${rejected === 1 ? '' : 's'} ignored — not an image`);
            }
            if (images.length === 0) return;
            setIsUploading(true);
            try {
                for (const file of images) {
                    try {
                        const uploaded = await uploadFile(file);
                        onDrop(uploaded);
                    } catch (err) {
                        reportError((err as Error)?.message || 'upload failed');
                    }
                }
            } finally {
                setIsUploading(false);
            }
            return;
        }

        // 3) External URL drop — fetch + re-host + emit. Prefer the typed
        //    `text/uri-list` (multi-URL) over `text/plain` (single line).
        if (acceptUrls) {
            const uriList = evt.dataTransfer.getData('text/uri-list');
            const plain = evt.dataTransfer.getData('text/plain');
            const raw = uriList || plain;
            if (raw) {
                const urls = raw
                    .split(/\r?\n/)
                    .map(s => s.trim())
                    .filter(s => s && !s.startsWith('#') && /^https?:\/\//i.test(s));
                if (urls.length > 0) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    setIsUploading(true);
                    try {
                        for (const url of urls) {
                            try {
                                const file = await urlToFile(url);
                                const uploaded = await uploadFile(file);
                                onDrop(uploaded);
                            } catch (err) {
                                reportError((err as Error)?.message || 'url re-host failed');
                            }
                        }
                    } finally {
                        setIsUploading(false);
                    }
                    return;
                }
            }
        }
    }, [onDrop, acceptFiles, acceptUrls, reportError]);

    return {
        isDragOver,
        isUploading,
        dropHandlers: {
            onDragEnter,
            onDragOver,
            onDragLeave,
            onDrop: handleDrop,
        },
    };
}
