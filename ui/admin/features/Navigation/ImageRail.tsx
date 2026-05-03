import React, {DragEvent, useEffect} from 'react';
import {Button, Empty, Input, Popconfirm, Spin, Tooltip} from 'antd';
import {CheckCircleFilled, CloseOutlined, DeleteOutlined, PictureOutlined, SearchOutlined} from '@client/lib/icons';
import {IMAGE_DRAG_MIME, serialiseImageForDrag} from '@client/lib/useImageDrop';
import {useViewModel} from '@client/lib/state/observable';
import {ImageRailViewModel} from './ImageRailViewModel';
export {useImageRailState} from './ImageRailViewModel';

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
 * Delete model (Google-Photos-style): hover a thumbnail to reveal a
 * check-circle (top-left) and trash icon (top-right); click the
 * check-circle to enter multi-select; the header gains an "N selected ·
 * Delete · Clear" toolbar that bulk-deletes via repeated
 * `assetApi.deleteImage` calls (no batch mutation exists yet).
 *
 * Note: `AssetService.deleteImage` only removes the Mongo record; the
 * file on disk is left intact and re-discoverable via `rescanDiskImages`.
 */
interface ImageRailProps {
    /** Whether the panel is currently docked open. Controlled from
     *  `AdminApp` so a matching toggle in the chrome can flip it. */
    open: boolean;
    /** Close button handler — the rail doesn't own its visibility state. */
    onClose: () => void;
}

const ImageRail: React.FC<ImageRailProps> = ({open, onClose}) => {
    const vm = useViewModel(() => new ImageRailViewModel());

    useEffect(() => {
        if (!open) return;
        void vm.refresh();
        return vm.subscribeRefresh();
    }, [open, vm]);

    // Drop selection IDs that disappeared from the latest fetch (e.g. another
    // tab deleted them) so the toolbar count never lies.
    useEffect(() => { vm.pruneSelection(); }, [vm.images, vm]);

    if (!open) return null;

    const filtered = vm.filtered;
    const selectMode = vm.selectMode;

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
                    <strong style={{flex: 1}}>{vm.selected.size} selected</strong>
                    <Popconfirm
                        title={`Delete ${vm.selected.size} image${vm.selected.size === 1 ? '' : 's'}?`}
                        description="The Mongo record is removed; the file on disk is kept."
                        okText="Delete"
                        okButtonProps={{danger: true, loading: vm.busy}}
                        onConfirm={() => vm.deleteIds([...vm.selected])}
                    >
                        <Button danger size="small" icon={<DeleteOutlined/>} loading={vm.busy}>Delete</Button>
                    </Popconfirm>
                    <Button size="small" onClick={vm.clearSelection} disabled={vm.busy}>Clear</Button>
                </div>
            )}
            <div style={{padding: 8}}>
                <Input
                    allowClear
                    size="small"
                    prefix={<SearchOutlined/>}
                    value={vm.filter}
                    onChange={e => vm.setFilter(e.target.value)}
                    placeholder="Filter by name / tag"
                />
            </div>
            <div style={{flex: 1, overflowY: 'auto', padding: '0 8px 8px 8px'}}>
                {vm.images === null && <div style={{textAlign: 'center', padding: 24}}><Spin/></div>}
                {vm.images !== null && filtered.length === 0 && (
                    <Empty description="No images" image={Empty.PRESENTED_IMAGE_SIMPLE}/>
                )}
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6}}>
                    {filtered.map((image, i) => {
                        const id = image.id;
                        const src = image.location ? `/${image.location}` : '';
                        const isSelected = vm.selected.has(id);
                        const isHovered = vm.hoverId === id;
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
                            if (selectMode) vm.toggleSelect(id);
                        };

                        return (
                            <Tooltip key={id ?? i} title={selectMode ? undefined : image.name} mouseEnterDelay={0.3}>
                                <div
                                    draggable={!selectMode}
                                    onDragStart={onDragStart}
                                    onClick={onBodyClick}
                                    onMouseEnter={() => vm.setHoverId(id)}
                                    onMouseLeave={() => { if (vm.hoverId === id) vm.setHoverId(null); }}
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
                                            onClick={(e) => { e.stopPropagation(); vm.toggleSelect(id); }}
                                            style={{
                                                position: 'absolute',
                                                top: 4,
                                                left: 4,
                                                width: 22,
                                                height: 22,
                                                borderRadius: '50%',
                                                border: 'none',
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
                                            onConfirm={() => vm.deleteIds([id])}
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
