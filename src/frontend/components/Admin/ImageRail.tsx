import React, {DragEvent, useCallback, useEffect, useMemo, useState} from 'react';
import {Button, Empty, Input, Spin, Tooltip} from 'antd';
import {CloseOutlined, PictureOutlined, SearchOutlined} from '../common/icons';
import AssetApi from '../../api/AssetApi';
import IImage from '../../../Interfaces/IImage';
import {refreshBus} from '../../lib/refreshBus';
import {IMAGE_DRAG_MIME, serialiseImageForDrag} from '../common/useImageDrop';

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

    const filtered = useMemo(() => {
        if (!images) return [];
        const q = filter.trim().toLowerCase();
        if (!q) return images;
        return images.filter(i =>
            (i.name ?? '').toLowerCase().includes(q) ||
            (Array.isArray(i.tags) ? i.tags.some(t => (t ?? '').toLowerCase().includes(q)) : false)
        );
    }, [images, filter]);

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
                        const src = image.location ? `/${image.location}` : '';
                        const onDragStart = (evt: DragEvent) => {
                            serialiseImageForDrag(evt, {
                                name: image.name,
                                location: image.location,
                                id: image.id,
                            });
                        };
                        return (
                            <Tooltip key={image.id ?? i} title={image.name} mouseEnterDelay={0.3}>
                                <div
                                    draggable
                                    onDragStart={onDragStart}
                                    style={{
                                        aspectRatio: '1 / 1',
                                        border: '1px solid #eee',
                                        borderRadius: 4,
                                        overflow: 'hidden',
                                        cursor: 'grab',
                                        background: '#fafafa',
                                        userSelect: 'none',
                                    }}
                                    data-drag-mime={IMAGE_DRAG_MIME}
                                >
                                    {src && <img
                                        src={src}
                                        alt={image.name}
                                        draggable={false}
                                        style={{width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none'}}
                                    />}
                                </div>
                            </Tooltip>
                        );
                    })}
                </div>
            </div>
            <footer style={{padding: 8, borderTop: '1px solid rgba(0,0,0,0.08)', fontSize: 11, color: '#888'}}>
                Drag a thumbnail onto an image module to set it.
            </footer>
        </aside>
    );
};

export default ImageRail;
