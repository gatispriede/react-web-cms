import {Alert, Button, Empty, Image as AntImage, Input, message, Modal, Popconfirm, Select, Space, Tag, Tooltip} from "antd";
import {CheckCircleFilled, CloudUploadOutlined, DeleteOutlined, EyeOutlined, InfoCircleOutlined, ReloadOutlined, SearchOutlined} from "@client/lib/icons";
import React, {useEffect, useMemo, useRef, useState} from "react";
import UpploadManager from "@services/infra/UpploadeManager";
import EditableTags from "@client/lib/EditableTags";
import MongoApi from "@services/api/client/MongoApi";
import {TFunction} from "i18next";
import IImage from "@interfaces/IImage";
import {useRefreshView} from "@client/lib/refreshBus";

/**
 * Picker sort modes. `recent` is the backend default; the others sort
 * client-side on the already-fetched list so an operator can re-order
 * without another round-trip. `size` descends so the largest (usually
 * highest-res hero shots) surface first — matches how we think about
 * "is this the master copy?". `unused` is intentionally missing: that
 * would need a usage-join on `Items.content` which isn't exposed yet,
 * and the image-optimization-on-upload (C2) landing width/height was
 * marked deferred, so orientation-filtering is also out of scope here.
 * See `docs/roadmap/picker-improvements.md` for the full list.
 */
type SortMode = 'recent' | 'name' | 'size';

const SORT_KEY = 'admin.imageUpload.sort';
const SEARCH_KEY = 'admin.imageUpload.search';

/** Pull persisted sort out of localStorage. Wrapped so SSR doesn't crash. */
const readSavedSort = (): SortMode => {
    if (typeof window === 'undefined') return 'recent';
    const raw = window.localStorage.getItem(SORT_KEY);
    return raw === 'name' || raw === 'size' ? raw : 'recent';
};
const readSavedSearch = (): string => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(SEARCH_KEY) ?? '';
};

/** Human-readable file size. AntD doesn't ship one and the numbers are
 *  meaningless when they read as raw byte counts. */
function formatBytes(n: number | undefined): string {
    if (!n || n <= 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) { v /= 1024; i += 1; }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

const ImageUpload = ({setFile, t}: { setFile: (file: File) => void, t: TFunction<"translation", undefined> }) => {

    const mongoApi = new MongoApi()

    // `useRef` (not `React.createRef`) — `React.createRef` returns a fresh
    // RefObject on every render, so the useEffect below that *captures*
    // the ref objects in its deps was comparing different identities each
    // render and silently mis-wiring the Uppload instance. Symptom: clicking
    // "Upload New Image" did literally nothing because the Uppload manager
    // was bound to a button DOM node from a stale render.
    const imageRef = useRef<HTMLImageElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const upploadManagerRef = useRef<UpploadManager | null>(null);

    const [error, setErrorState] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [images, setImages] = useState<IImage[]>([])
    const [searchTag, setSearchTag] = useState(readSavedSearch())
    const [rescanning, setRescanning] = useState(false)
    const [previewSrc, setPreviewSrc] = useState<string | null>(null)
    const [sortMode, setSortMode] = useState<SortMode>(readSavedSort())
    // Image currently being hovered / focused. Drives the persistent
    // preview panel on the right — a non-modal "quick check" the roadmap
    // calls for so operators can disambiguate similar filenames before
    // committing. Sticks to the last confirmed-hovered tile on mouse-leave
    // so the panel stays useful while the operator reads filename / size.
    const [focusImage, setFocusImage] = useState<IImage | null>(null)
    // Per-tile info drawer state. Only one tile can be expanded at a time —
    // otherwise grids tear vertically as rows grow inconsistently.
    const [expandedId, setExpandedId] = useState<string | null>(null)
    // Bulk-select state — mirrors the ImageRail UX so multi-delete works the
    // same way in either entry point (rail = sidebar dock, this modal =
    // legacy picker). `selectMode` is derived from `selected.size > 0` so
    // the operator enters/leaves it implicitly by toggling the check circle.
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [bulkBusy, setBulkBusy] = useState(false)
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
    const selectMode = selected.size > 0
    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }
    const clearSelection = () => setSelected(new Set())
    const bulkDelete = async () => {
        const ids = [...selected];
        if (!ids.length) return;
        setBulkBusy(true);
        let ok = 0, fail = 0;
        for (const id of ids) {
            try { await mongoApi.deleteImage(id); ok++; }
            catch (err) { console.error('[image-picker] delete failed', id, err); fail++; }
        }
        setBulkBusy(false);
        clearSelection();
        if (fail === 0) message.success(t('Deleted {{count}} images', {count: ok}) as string);
        else message.warning(t('Deleted {{ok}}, {{fail}} failed', {ok, fail}) as string);
        await loadImages();
    }

    const cb = async (inputFile: File) => {
        setFile(inputFile)
        // Newly uploaded file — refresh the gallery list so the next open
        // (or the side grid rendered right below) sees it without a manual
        // reload. `UpploadManager` now awaits the /api/upload round-trip
        // before calling us, so the row is already in Mongo.
        try { await loadImages() } catch { /* noop */ }
    }
    const setError = (err: string) => {
        console.error(err)
        setErrorState(err)
    }

    const setTags = (tags: string[]) => {
        if (upploadManagerRef.current) {
            upploadManagerRef.current.setTags(tags);
        }
    }
    const loadImages = async (override?: string) => {
        const raw = override ?? searchTag
        const tag = raw && raw.trim().length > 0 ? raw.trim() : 'All'
        const imgs: IImage[] = await mongoApi.getImages(tag)
        setImages(imgs)
    }

    /**
     * Auto-rescan when the DB-backed list comes back empty. This used to
     * require the operator to click "Rescan Disk" on every fresh local DB
     * (or after importing a new bundle without a paired upload pass) which
     * was confusing — files exist on disk under `public/images/`, but the
     * `Images` collection that drives this picker hadn't been seeded yet.
     * Now any time the picker opens to an empty list, we transparently
     * reconcile from disk so the operator sees the images they expect.
     *
     * Bound by a sentinel so we only do this once per session: the operator
     * may legitimately end up with an empty list after deleting everything,
     * and we don't want to keep refilling it from disk on every open.
     */
    const autoRescanedRef = useRef<boolean>(false);
    const ensureNotEmpty = async () => {
        if (autoRescanedRef.current) return;
        // Use the most recent state — `images` here is from the closure of
        // the previous render, so we re-read after `loadImages()` resolved.
        // The simpler way: ask Mongo directly, but the API roundtrip we
        // already did set `images` via setState; React batches, so check
        // the synchronous result via getImages here.
        const tag = (searchTag && searchTag.trim().length > 0) ? searchTag.trim() : 'All';
        const fresh: IImage[] = await mongoApi.getImages(tag);
        if (fresh.length > 0) return;
        autoRescanedRef.current = true;
        try {
            await mongoApi.rescanDiskImages();
            await loadImages();
        } catch (err) {
            // Don't surface as a hard error — the operator can still click
            // Rescan Disk manually if disk-discovery is genuinely broken.
            console.warn('auto-rescan-on-open failed:', err);
        }
    }

    const rescanDisk = async () => {
        setRescanning(true)
        try {
            const r = await mongoApi.rescanDiskImages()
            message.success(String(t('Rescan complete: {{added}} added, {{skipped}} already known ({{total}} on disk)', r as any)))
            await loadImages()
        } catch (e: any) {
            message.error(String(e?.message ?? e))
        } finally {
            setRescanning(false)
        }
    }

    // Wire (or re-wire) the Uppload manager whenever the modal opens. The
    // refs are stable across renders now (`useRef`), but the modal contents
    // mount lazily on `open=true`, so refs are only populated after the
    // open-toggle render commits. Running on `dialogOpen` covers that.
    useEffect(() => {
        if (!dialogOpen) return;
        // Defer one frame: AntD Modal portals contents on `open=true`, but
        // on the very first open the children commit slightly after the
        // outer Modal wrapper, so we'd otherwise miss the button on first
        // click ("Upload New Image" did nothing first time, worked second").
        const handle = requestAnimationFrame(() => {
            if (!imageRef.current || !buttonRef.current) return;
            // The manager itself owns the focus-trap-conflict workaround
            // via private class state — see `UpploadManager.setHostSelector`.
            // We tag the picker Modal root via `modalRender` below; the
            // manager re-parents Uppload's DOM into that root on open and
            // installs a capturing focusin listener that stops AntD's
            // document-level handler from yanking focus back, breaking the
            // rc-util/focus-trap ping-pong (`RangeError: Maximum call stack
            // size exceeded`).
            const mgr = new UpploadManager(imageRef.current, buttonRef.current, cb, setError);
            mgr.setHostSelector('[data-image-picker-root]');
            upploadManagerRef.current = mgr;
        });
        // Auto-load. If the DB has nothing yet (fresh local dev DB or a
        // freshly imported bundle) the disk-rescan kicks in below so the
        // picker is never blank.
        void (async () => {
            await loadImages();
            await ensureNotEmpty();
        })();
        return () => cancelAnimationFrame(handle);
    }, [dialogOpen])
    useRefreshView(loadImages, 'assets');

    // Drop selected IDs that disappeared from the latest fetch so the
    // toolbar count never lies (e.g. another tab or a bundle reimport
    // wiped a row out from under us).
    useEffect(() => {
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

    // Persist sort / search so the picker reopens where you left it.
    // Reload survives this (the roadmap asked for URL-param round-tripping,
    // but the picker is a modal — URL would collide with whatever page the
    // operator is editing. localStorage gives the same "survives reload"
    // property without polluting the page URL).
    useEffect(() => {
        if (typeof window !== 'undefined') window.localStorage.setItem(SORT_KEY, sortMode);
    }, [sortMode]);
    useEffect(() => {
        if (typeof window !== 'undefined') window.localStorage.setItem(SEARCH_KEY, searchTag);
    }, [searchTag]);

    // Live search: debounce so the gallery filters as the user types instead
    // of requiring an explicit "Search Images" click.
    const onSearchChange = (v: string) => {
        setSearchTag(v)
        if (searchDebounce.current) clearTimeout(searchDebounce.current)
        searchDebounce.current = setTimeout(() => { void loadImages(v) }, 250)
    }

    // Sort on the already-fetched list. The backend already returns `recent`
    // first (by `created` descending), so `recent` is identity — we just
    // mirror the list in that branch to keep the reducer semantics uniform.
    const sortedImages = useMemo(() => {
        const out = [...images];
        if (sortMode === 'name') {
            out.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        } else if (sortMode === 'size') {
            out.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
        }
        return out;
    }, [images, sortMode]);

    // Derived preview target — hovered tile wins, confirmed-selected fallback.
    const previewTarget = focusImage;
    const previewUrl = previewTarget ? `/${previewTarget.location}` : null;

    return (
        <div>
            <Button type={'primary'} onClick={() => {
                setDialogOpen(true)
            }}>
                {t("Select Image")}
            </Button>
            <Modal
                width={'min(1200px, 95vw)'}
                title={t('Image Selection')}
                // Cap the body height so a large library doesn't push the
                // Modal taller than the viewport. The grid + preview pane
                // both scroll inside this cap.
                styles={{body: {maxHeight: 800, overflow: 'auto'}}}
                open={dialogOpen}
                onCancel={async () => {
                    setDialogOpen(false)
                }}
                onOk={async () => {
                    setDialogOpen(false)
                }}
            >
                <div className={'image-upload'}>
                    {error !== '' && (
                        <Alert
                            style={{marginBottom: 12}}
                            message={t("Error")}
                            description={error}
                            type="error"
                            showIcon
                            closable
                            onClose={() => setErrorState('')}
                        />
                    )}

                    <div className={'upload-image-container'}>
                        <div>
                            <div className={'tag-container'}>
                                <label className={'field-label'}>
                                    {t("Tags applied to next upload")}
                                </label>
                                <EditableTags setTagsProp={(tags: string[]) => setTags(tags)}/>
                                <div className={'field-hint'}>
                                    {t("Every upload is also tagged 'All' automatically.")}
                                </div>
                            </div>
                            <Space wrap>
                                <Button ref={buttonRef} type="primary" icon={<CloudUploadOutlined/>}>
                                    {t("Upload New Image")}
                                </Button>
                                <Tooltip title={t("Scan public/images on the server and add any files missing from the library.")}>
                                    <Button
                                        onClick={rescanDisk}
                                        loading={rescanning}
                                        icon={<ReloadOutlined/>}
                                    >
                                        {t("Rescan Disk")}
                                    </Button>
                                </Tooltip>
                            </Space>
                        </div>
                        <div className={'image-preview'}>
                            <div className={'field-hint'} style={{marginBottom: 4}}>{t("Upload preview")}</div>
                            <img
                                ref={imageRef}
                                alt=""
                                className="uppload-image"
                            />
                        </div>
                    </div>

                    <div className={'image-select-container'}>
                        <div className={'image-search-container'}>
                            <Input
                                allowClear
                                prefix={<SearchOutlined/>}
                                placeholder={t("Filter by tag (leave empty for all)")}
                                value={searchTag}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onPressEnter={() => loadImages()}
                            />
                            <Button onClick={() => loadImages()}>{t("Search")}</Button>
                            <Select<SortMode>
                                value={sortMode}
                                style={{minWidth: 140}}
                                onChange={setSortMode}
                                options={[
                                    {value: 'recent', label: t('Sort: recent')},
                                    {value: 'name', label: t('Sort: name')},
                                    {value: 'size', label: t('Sort: size')},
                                ]}
                            />
                            <span className={'result-count'}>
                                {t('{{count}} images', {count: sortedImages.length})}
                            </span>
                        </div>

                        {selectMode && (
                            <div style={{
                                padding: '6px 10px',
                                margin: '0 0 8px 0',
                                background: '#e6f4ff',
                                border: '1px solid #91caff',
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 13,
                            }}>
                                <strong style={{flex: 1}}>{t('{{count}} selected', {count: selected.size})}</strong>
                                <Popconfirm
                                    title={t('Delete {{count}} images?', {count: selected.size})}
                                    description={t('The Mongo record is removed; the file on disk is kept.')}
                                    okText={t('Delete')}
                                    cancelText={t('Cancel')}
                                    okButtonProps={{danger: true, loading: bulkBusy}}
                                    onConfirm={bulkDelete}
                                >
                                    <Button danger size="small" icon={<DeleteOutlined/>} loading={bulkBusy}>
                                        {t('Delete')}
                                    </Button>
                                </Popconfirm>
                                <Button size="small" onClick={clearSelection} disabled={bulkBusy}>
                                    {t('Clear')}
                                </Button>
                            </div>
                        )}

                        {/* Two-column layout: tile grid + sticky preview panel.
                            Panel width floors at ~200px so filename + metadata
                            stay readable; it grows with viewport via minmax.
                            Inline resize handle tweak-sizes the preview box
                            without relaunching into a custom lightbox (AntD's
                            `AntImage preview` lives in the portal below, kept
                            for the operator's explicit "zoom me" click). */}
                        <div className={'image-grid-layout'}>
                            <div className={'image-result-container'}>
                                {sortedImages.length === 0 && (
                                    <div style={{gridColumn: '1 / -1'}}>
                                        <Empty description={t("No images — upload one or click 'Rescan Disk'.")}/>
                                    </div>
                                )}
                                {sortedImages.map((image: IImage, index) => {
                                    const src = `/${image.location}`
                                    const tileId = image.id ?? `${image.name}-${index}`;
                                    const isExpanded = expandedId === tileId;
                                    const isSelected = selected.has(image.id);
                                    return (
                                        <div
                                            className={`image-item${isExpanded ? ' is-expanded' : ''}${isSelected ? ' is-selected' : ''}`}
                                            key={tileId}
                                            tabIndex={0}
                                            onMouseEnter={() => setFocusImage(image)}
                                            onFocus={() => setFocusImage(image)}
                                            onClick={() => {
                                                // While curating a delete batch, body-clicks toggle
                                                // selection instead of committing the pick. Otherwise
                                                // the operator would accidentally close the modal mid-
                                                // multi-select.
                                                if (selectMode) { toggleSelect(image.id); return; }
                                                setFile(image as unknown as File)
                                                setDialogOpen(false)
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    if (selectMode) { toggleSelect(image.id); return; }
                                                    setFile(image as unknown as File);
                                                    setDialogOpen(false);
                                                }
                                            }}
                                            style={isSelected ? {outline: '2px solid #1677ff', outlineOffset: -2} : undefined}
                                        >
                                            <img
                                                src={src}
                                                alt={image.name}
                                                className={'image-item__thumb'}
                                                loading="lazy"
                                                style={isSelected ? {filter: 'brightness(0.92)'} : undefined}
                                            />

                                            {/* Top-left select-toggle. Always shown so the affordance
                                                is discoverable without a hover (mobile / touchpad
                                                hover is unreliable inside the modal); the dark
                                                backdrop keeps it readable on any photo. */}
                                            <button
                                                type="button"
                                                aria-label={isSelected ? t('Deselect image') as string : t('Select image') as string}
                                                onClick={(e) => { e.stopPropagation(); toggleSelect(image.id); }}
                                                style={{
                                                    position: 'absolute',
                                                    top: 6,
                                                    left: 6,
                                                    width: 24,
                                                    height: 24,
                                                    borderRadius: '50%',
                                                    border: 'none',
                                                    background: isSelected ? '#fff' : 'rgba(0,0,0,0.55)',
                                                    color: isSelected ? '#1677ff' : '#fff',
                                                    cursor: 'pointer',
                                                    padding: 0,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    zIndex: 2,
                                                }}
                                            >
                                                {isSelected
                                                    ? <CheckCircleFilled style={{fontSize: 22, background: '#fff', borderRadius: '50%'}}/>
                                                    : <span style={{
                                                        width: 14, height: 14, borderRadius: '50%',
                                                        border: '2px solid currentColor', display: 'block',
                                                    }}/>}
                                            </button>

                                            <div
                                                className={'image-item__actions'}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Tooltip title={t("More info")}>
                                                    <Button
                                                        size="small"
                                                        shape="circle"
                                                        type={isExpanded ? 'primary' : 'default'}
                                                        icon={<InfoCircleOutlined/>}
                                                        onClick={() => setExpandedId(isExpanded ? null : tileId)}
                                                        aria-label={t('More info')}
                                                        aria-expanded={isExpanded}
                                                    />
                                                </Tooltip>
                                                <Tooltip title={t("Preview")}>
                                                    <Button
                                                        size="small"
                                                        shape="circle"
                                                        icon={<EyeOutlined/>}
                                                        onClick={() => setPreviewSrc(src)}
                                                        aria-label={t('Preview')}
                                                    />
                                                </Tooltip>
                                                <Popconfirm
                                                    title={t("Delete")}
                                                    description={t("Are you sure to delete?")}
                                                    okText={t("Delete")}
                                                    cancelText={t("Cancel")}
                                                    onConfirm={async () => {
                                                        await mongoApi.deleteImage(image.id);
                                                        await loadImages()
                                                    }}
                                                >
                                                    <Tooltip title={t("Delete")}>
                                                        <Button size="small" shape="circle" danger icon={<DeleteOutlined/>} aria-label={t('Delete')}/>
                                                    </Tooltip>
                                                </Popconfirm>
                                            </div>

                                            {/* Filename strip — always visible now (the roadmap
                                                called out "same filenames are common", so we stop
                                                hiding the label behind a hover). */}
                                            <div className={'image-item__caption'} title={image.name}>
                                                <span className={'image-item__name'}>{image.name}</span>
                                                <span className={'image-item__size'}>{formatBytes(image.size)}</span>
                                            </div>

                                            {isExpanded && (
                                                <div
                                                    className={'image-item__details'}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <div><strong>{t('File')}:</strong> {image.name}</div>
                                                    <div><strong>{t('Size')}:</strong> {formatBytes(image.size)}</div>
                                                    <div><strong>{t('Type')}:</strong> {image.type || '—'}</div>
                                                    <div><strong>{t('Added')}:</strong> {image.created || '—'}</div>
                                                    {Array.isArray(image.tags) && image.tags.length > 0 && (
                                                        <div style={{marginTop: 4}}>
                                                            {image.tags.filter(Boolean).map((tag) => (
                                                                <Tag key={tag} color="blue">{tag}</Tag>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Persistent preview box — mirrors whichever tile the
                                cursor / keyboard-focus is on. Falls back to the
                                AntD-style placeholder when nothing's hovered so the
                                column doesn't jump-collapse. Native CSS `resize`
                                handle on the outer box satisfies the roadmap's
                                "~100×60 default, resizable to ~400×240" requirement
                                without us wiring a drag handler. */}
                            <aside className={'image-preview-panel'}>
                                <div className={'field-hint'} style={{marginBottom: 6}}>{t("Preview")}</div>
                                <div className={'image-preview-panel__box'}>
                                    {previewUrl ? (
                                        <img src={previewUrl} alt={previewTarget?.name ?? ''}/>
                                    ) : (
                                        <div className={'image-preview-panel__placeholder'}>
                                            {t('Hover or focus a tile')}
                                        </div>
                                    )}
                                </div>
                                {previewTarget && (
                                    <div className={'image-preview-panel__meta'}>
                                        <div className={'image-preview-panel__name'} title={previewTarget.name}>
                                            {previewTarget.name}
                                        </div>
                                        <div className={'image-preview-panel__size'}>
                                            {formatBytes(previewTarget.size)}
                                            {previewTarget.type ? ` · ${previewTarget.type.replace('image/', '')}` : ''}
                                        </div>
                                    </div>
                                )}
                            </aside>
                        </div>

                    </div>
                </div>
            </Modal>
            {/* Preview portal lives OUTSIDE the selection Modal so AntD's
                preview overlay stacks above everything (rendering it inside
                left the Modal header visible as a thin strip on top). */}
            {previewSrc && (
                <AntImage
                    style={{display: 'none'}}
                    src={previewSrc}
                    preview={{
                        visible: true,
                        src: previewSrc,
                        onVisibleChange: (v) => { if (!v) setPreviewSrc(null) },
                    }}
                />
            )}
        </div>
    )
}

export default ImageUpload
