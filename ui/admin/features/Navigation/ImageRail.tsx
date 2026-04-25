import React, {DragEvent, useCallback, useEffect, useMemo, useState} from 'react';
import {Button, Empty, Input, message, Popconfirm, Spin, Tooltip} from 'antd';
import {CheckCircleFilled, CloseOutlined, DeleteOutlined, PictureOutlined, SearchOutlined} from '@client/lib/icons';
import AssetApi from '@services/api/client/AssetApi';
import IImage from '@interfaces/IImage';
import {refreshBus} from '@client/lib/refreshBus';
import {IMAGE_DRAG_MIME, serialiseImageForDrag} from '@client/lib/useImageDrop';

/**
 * Dockable right-hand image library for DnD phase 2. An editor drags a
 * thumbnail from here into any `InputPlainImage` / `InputGallery` /
 * `InputCarousel` drop zone to set its image — no more modal round-trip.
 *
 * Uses native HTML5 DnD (not dnd-kit) because the rail sits at
 * `AdminApp` level while drop targets live deep inside per-section
 * `<DndContext>` wrappers; dnd-kit drags can't cross context boundaries,
 * but `dataTransfer` does.
 *
 * Collapsed-state is persisted to `localStorage.admin.imageRail.open` so
 * the admin's choice survives a page refresh. Fetches via
 * `AssetApi.getImages('All')`; the `All` tag is auto-added to every
 * upload, so it's always the broadest set available.
 *
 * Delete model (Google-Photos-style):
 *   - hover a thumbnail to reveal a check-circle (top-left) and trash icon
 *     (top-right);
 *   - click the check-circle to enter multi-select; further clicks on
 *     thumbnail bodies toggle selection (drag is suppressed while in
 *     select mode);
 *   - the header gains an "N selected · Delete · Clear" toolbar that
 *     bulk-deletes via repeated `assetApi.deleteImage` calls (no batch
 *     mutation exists yet — see GraphQL schema);
 *   - per-image trash icon stays available for the common single-delete
 *     case so the operator doesn't have to enter select mode for one item.
 *
 * Note: `AssetService.deleteImage` only removes the Mongo record; the
 * file on disk is left intact and re-discoverable via `rescanDiskImages`.
 * That's the existing single-delete contract, mirrored here.
 */
interface ImageRailProps {
    /** Whether the panel is currently docked open. Controlled from
     *  `AdminApp` so a matching toggle in the chrome can flip it. */
    open: boolean;
    /** Close button handler — the rail doesn't own its visibility state. */
    onClose: () => void;
}

const STORAGE_KEY = 'admin.imageRail.open';

export function useImageRailState(): [boolean, (next: boolean) => void] {
    const [open, setOpen] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        try { return window.localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
    });
    const set = useCallback((next: boolean) => {
        setOpen(next);
        try { window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* noop */ }
    }, []);
    return [open, set];
}

const assetApi = new AssetApi();

const ImageRail: React.FC<ImageRailProps> = ({open, onClose}) => {
    const [images, setImages] = useState<IImage[] | null>(null);
    const [filter, setFilter] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [hoverId, setHoverId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const refresh = useCallback(async () => {
        setImages(null);
        try {
            const list = await assetApi.getImages('All');
            setImages(Array.isArray(list) ? list : []);
        } catch {
            setImages([]);
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        void refresh();
        return refreshBus.subscribe(refresh, 'assets');
    }, [open, refresh]);

    // Drop selection IDs that disappeared from the latest fetch (e.g. another
    // tab deleted them) so the toolbar count never lies.
    useEffect(() => {
        if (!images) return;
        const live = new Set(images.map(i => i.id));
        setSelected(prev => {
            let changed = false;
            const next = new Set<string>();
            for (const id of prev) {
                if (live.has(id)) next.add(id);
                else changed = true;
            }
            return changed ? next : prev;
        });
    }, [images]);

    const filtered = useMemo(() => {
        if (!images) return [];
        const q = filter.trim().toLowerCase();
        if (!q) return images;
        return images.filter(i =>
            (i.name ?? '').toLowerCase().includes(q) ||
            (Array.isArray(i.tags) ? i.tags.some(t => (t ?? '').toLowerCase().includes(q)) : false)
        );
    }, [images, filter]);

    const selectMode = selected.size > 0;

    const toggleSelect = useCallback((id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => setSelected(new Set()), []);

    const deleteIds = useCallback(async (ids: string[]) => {
        if (!ids.length) return;
        setBusy(true);
        let ok = 0, fail = 0;
        // Sequential to avoid hammering the GraphQL endpoint and to keep the
        // failure surface readable — bulk image deletes are rare enough that
        // the latency cost is acceptable.
        for (const id of ids) {
            try { await assetApi.deleteImage(id); ok++; }
            catch (err) { console.error('[image-rail] delete failed', id, err); fail++; }
        }
        setBusy(false);
        clearSelection();
        if (fail === 0) message.success(`Deleted ${ok} image${ok === 1 ? '' : 's'}`);
        else message.warning(`Deleted ${ok}, ${fail} failed`);
        await refresh();
    }, [clearSelection, refresh]);

    if (!open) return null;

    return (
        <aside
            aria-label="Image library"
            style={{
                position: 'fixed',
                top: 56,
                right: 0,
                bottom: 0,
                width: 260,
                zIndex: 400,
                background: '#fff',
                borderLeft: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '-4px 0 16px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <header style={{padding: '8px 10px', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 8}}>
                <PictureOutlined/>
                <strong style={{flex: 1, fontSize: 13}}>Images</strong>
                <Tooltip title="Close">
                    <Button type="text" size="small" icon={<CloseOutlined/>} onClick={onClose} aria-label="Close image rail"/>
                </Tooltip>
            </header>
            {selectMode && (
                <div style={{
                    padding: '6px 10px',
                    background: '#e6f4ff',
                    borderBottom: '1px solid #91caff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                }}>
                    <strong style={{flex: 1}}>{selected.size} selected</strong>
                    <Popconfirm
                        title={`Delete ${selected.size} image${selected.size === 1 ? '' : 's'}?`}
                        description="The Mongo record is removed; the file on disk is kept."
                        okText="Delete"
                        okButtonProps={{danger: true, loading: busy}}
                        onConfirm={() => deleteIds([...selected])}
                    >
                        <Button danger size="small" icon={<DeleteOutlined/>} loading={busy}>Delete</Button>
                    </Popconfirm>
                    <Button size="small" onClick={clearSelection} disabled={busy}>Clear</Button>
                </div>
            )}
            <div style={{padding: 8}}>
                <Input
                    allowClear
                    size="small"
                    prefix={<SearchOutlined/>}
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Filter by name / tag"
                />
            </div>
            <div style={{flex: 1, overflowY: 'auto', padding: '0 8px 8px 8px'}}>
                {images === null && <div style={{textAlign: 'center', padding: 24}}><Spin/></div>}
                {images !== null && filtered.length === 0 && (
                    <Empty description="No images" image={Empty.PRESENTED_IMAGE_SIMPLE}/>
                )}
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6}}>
                    {filtered.map((image, i) => {
                        const id = image.id;
                        const src = image.location ? `/${image.location}` : '';
                        const isSelected = selected.has(id);
                        const isHovered = hoverId === id;
                        const showOverlay = isHovered || isSelected || selectMode;

                        const onDragStart = (evt: DragEvent) => {
                            // Suppress drag while user is curating a delete batch — otherwise
                            // a stray click on the body would yank the image into a drop zone
                            // mid-selection.
                            if (selectMode) { evt.preventDefault(); return; }
                            serialiseImageForDrag(evt, {
                                name: image.name,
                                location: image.location,
                                id: image.id,
                            });
                        };

                        const onBodyClick = () => {
                            if (selectMode) toggleSelect(id);
                        };

                        return (
                            <Tooltip key={id ?? i} title={selectMode ? undefined : image.name} mouseEnterDelay={0.3}>
                                <div
                                    draggable={!selectMode}
                                    onDragStart={onDragStart}
                                    onClick={onBodyClick}
                                    onMouseEnter={() => setHoverId(id)}
                                    onMouseLeave={() => setHoverId(prev => prev === id ? null : prev)}
                                    style={{
                                        position: 'relative',
                                        aspectRatio: '1 / 1',
                                        border: isSelected ? '2px solid #1677ff' : '1px solid #eee',
                                        borderRadius: 4,
                                        overflow: 'hidden',
                                        cursor: selectMode ? 'pointer' : 'grab',
                                        background: '#fafafa',
                                        userSelect: 'none',
                                        transition: 'border-color 120ms',
                                    }}
                                    data-drag-mime={IMAGE_DRAG_MIME}
                                >
                                    {src && <img
                                        src={src}
                                        alt={image.name}
                                        draggable={false}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            pointerEvents: 'none',
                                            // Slight dim on selected so the blue ring reads better.
                                            filter: isSelected ? 'brightness(0.92)' : undefined,
                                        }}
                                    />}

                                    {/* Top-left: select-toggle circle. Always visible once
                                        selected; otherwise only on hover. Clicking does NOT
                                        propagate so it never triggers the drag handler. */}
                                    {showOverlay && (
                                        <button
                                            type="button"
                                            aria-label={isSelected ? 'Deselect image' : 'Select image'}
                                            onClick={(e) => { e.stopPropagation(); toggleSelect(id); }}
                                            style={{
                                                position: 'absolute',
                                                top: 4,
                                                left: 4,
                                                width: 22,
                                                height: 22,
                                                borderRadius: '50%',
                                                border: 'none',
                                                // Solid dark backdrop on the unselected ring so the
                                                // affordance reads against bright thumbnails (the
                                                // earlier transparent ring with drop-shadow was
                                                // invisible on light photos — client report
                                                // 2026-04-25).
                                                background: isSelected ? '#fff' : 'rgba(0,0,0,0.55)',
                                                cursor: 'pointer',
                                                padding: 0,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: isSelected ? '#1677ff' : '#fff',
                                            }}
                                        >
                                            {isSelected
                                                ? <CheckCircleFilled style={{fontSize: 22, background: '#fff', borderRadius: '50%'}}/>
                                                : <span style={{
                                                    width: 14, height: 14, borderRadius: '50%',
                                                    border: '2px solid currentColor', display: 'block',
                                                }}/>}
                                        </button>
                                    )}

                                    {/* Top-right: per-image trash. Only when hovered AND not in
                                        bulk-select mode (the toolbar covers the bulk case). */}
                                    {isHovered && !selectMode && (
                                        <Popconfirm
                                            title={`Delete "${image.name}"?`}
                                            description="The Mongo record is removed; the file on disk is kept."
                                            okText="Delete"
                                            okButtonProps={{danger: true}}
                                            onConfirm={() => deleteIds([id])}
                                            onCancel={(e) => e?.stopPropagation()}
                                        >
                                            <button
                                                type="button"
                                                aria-label={`Delete ${image.name}`}
                                                onClick={(e) => e.stopPropagation()}
                                                style={{
                                                    position: 'absolute',
                                                    top: 4,
                                                    right: 4,
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: '50%',
                                                    border: 'none',
                                                    background: 'rgba(0,0,0,0.55)',
                                                    color: '#fff',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <DeleteOutlined style={{fontSize: 12}}/>
                                            </button>
                                        </Popconfirm>
                                    )}
                                </div>
                            </Tooltip>
                        );
                    })}
                </div>
            </div>
            <footer style={{padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)', fontSize: 11, color: '#888'}}>
                {selectMode
                    ? 'Click a thumbnail to toggle selection. Drag is paused while selecting.'
                    : 'Drag a thumbnail onto an image module to set it. Hover to select or delete.'}
            </footer>
        </aside>
    );
};

export default ImageRail;
