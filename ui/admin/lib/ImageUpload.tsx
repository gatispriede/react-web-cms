import {Alert, Button, Empty, Image as AntImage, Input, Modal, Popconfirm, Select, Space, Tag, Tooltip} from "antd";
import {notifyError, notifySuccess, notifyWarning} from '@admin/lib/notify';
import {CheckCircleFilled, CloudUploadOutlined, DeleteOutlined, EyeOutlined, InfoCircleOutlined, ReloadOutlined, SearchOutlined} from "@client/lib/icons";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import UpploadManager from "@services/infra/UpploadeManager";
import EditableTags from "@client/lib/EditableTags";
import MongoApi from "@services/api/client/MongoApi";
import {TFunction} from "i18next";
import IImage from "@interfaces/IImage";
import {useRefreshView} from "@client/lib/refreshBus";
import BulkImageUploadModal from "@admin/lib/BulkImageUploadModal";

/**
 * Picker sort modes (picker-improvements C5).
 *
 * `recent` is the backend default (Mongo returns by `created` desc); `name`
 * and `size` re-order the already-fetched list client-side so the operator
 * doesn't pay a round-trip. `unused` sorts by `usageCount` ascending so
 * never-referenced images float to the top — handy for cleanup. `usageCount`
 * is populated by `AssetService.listImagesWithUsage()`; when the field is
 * absent (the plain GraphQL `getImages` path doesn't surface it yet) `unused`
 * degrades to `recent` order rather than throwing.
 */
type SortMode = 'recent' | 'name' | 'size' | 'unused';

/** Orientation filter — derived from width/height, falling back to the
 *  client-measured natural dimensions of the loaded <img> for legacy rows
 *  uploaded before the optimise pipeline persisted dimensions. */
type OrientationFilter = 'any' | 'landscape' | 'portrait' | 'square';

/** Picker view-state lives in the page URL so a reload restores sort +
 *  filters. Params are namespaced (`pkr*`) so they never collide with
 *  whatever the edited page itself reads off the query string. */
const URL_PARAMS = {
    sort: 'pkrSort',
    search: 'pkrSearch',
    hasTag: 'pkrTag',
    orientation: 'pkrOrient',
} as const;

/** Per-image alt-text + tag overrides. The picker can edit these without
 *  closing, and they survive a reload — but there's no `updateImage` GraphQL
 *  mutation yet, so persistence is a localStorage override store keyed by
 *  image id. Centralising alt here (vs per-section) is the a11y win the
 *  roadmap calls for; the store is the bridge until the mutation lands. */
const META_OVERRIDE_KEY = 'admin.imageUpload.metaOverrides';

interface MetaOverride {
    alt?: string;
    tags?: string[];
}

const readMetaOverrides = (): Record<string, MetaOverride> => {
    if (typeof window === 'undefined') return {};
    try {
        return JSON.parse(window.localStorage.getItem(META_OVERRIDE_KEY) ?? '{}') as Record<string, MetaOverride>;
    } catch {
        return {};
    }
};
const writeMetaOverrides = (next: Record<string, MetaOverride>): void => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(META_OVERRIDE_KEY, JSON.stringify(next));
};

/** Read the initial picker view-state out of the page URL. SSR-safe. */
const readUrlState = () => {
    if (typeof window === 'undefined') {
        return {sort: 'recent' as SortMode, search: '', hasTag: '', orientation: 'any' as OrientationFilter};
    }
    const q = new URLSearchParams(window.location.search);
    const rawSort = q.get(URL_PARAMS.sort);
    const sort: SortMode = rawSort === 'name' || rawSort === 'size' || rawSort === 'unused' ? rawSort : 'recent';
    const rawOrient = q.get(URL_PARAMS.orientation);
    const orientation: OrientationFilter =
        rawOrient === 'landscape' || rawOrient === 'portrait' || rawOrient === 'square' ? rawOrient : 'any';
    return {
        sort,
        search: q.get(URL_PARAMS.search) ?? '',
        hasTag: q.get(URL_PARAMS.hasTag) ?? '',
        orientation,
    };
};

/** Write the picker view-state back to the URL via `replaceState` (no history
 *  spam, no navigation). Empty / default values drop their param so the URL
 *  stays clean. */
const syncUrlState = (state: {sort: SortMode; search: string; hasTag: string; orientation: OrientationFilter}): void => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search);
    const set = (key: string, value: string, isDefault: boolean) => {
        if (isDefault || !value) q.delete(key);
        else q.set(key, value);
    };
    set(URL_PARAMS.sort, state.sort, state.sort === 'recent');
    set(URL_PARAMS.search, state.search, false);
    set(URL_PARAMS.hasTag, state.hasTag, false);
    set(URL_PARAMS.orientation, state.orientation, state.orientation === 'any');
    const qs = q.toString();
    const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
    window.history.replaceState(window.history.state, '', url);
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

/** Classify orientation from a width/height pair. A 5% tolerance band counts
 *  near-square crops as `square` so a 1001×1000 hero doesn't read "landscape". */
function orientationOf(w?: number, h?: number): OrientationFilter | null {
    if (!w || !h) return null;
    const ratio = w / h;
    if (ratio > 1.05) return 'landscape';
    if (ratio < 0.95) return 'portrait';
    return 'square';
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

    const initialUrlState = readUrlState();

    const [error, setErrorState] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [images, setImages] = useState<IImage[]>([])
    const [searchTag, setSearchTag] = useState(initialUrlState.search)
    const [rescanning, setRescanning] = useState(false)
    const [previewSrc, setPreviewSrc] = useState<string | null>(null)
    const [sortMode, setSortMode] = useState<SortMode>(initialUrlState.sort)
    // Paired filters (picker-improvements C5). `hasTag` narrows to images
    // carrying a tag substring; `orientation` narrows by aspect ratio. Both
    // round-trip through the URL alongside `sortMode` + `searchTag`.
    const [hasTagFilter, setHasTagFilter] = useState(initialUrlState.hasTag)
    const [orientationFilter, setOrientationFilter] = useState<OrientationFilter>(initialUrlState.orientation)
    // Image currently being hovered / focused. Drives the persistent
    // preview panel on the right — a non-modal "quick check" the roadmap
    // calls for so operators can disambiguate similar filenames before
    // committing. Sticks to the last confirmed-hovered tile on mouse-leave
    // so the panel stays useful while the operator reads filename / size.
    const [focusImage, setFocusImage] = useState<IImage | null>(null)
    // Per-tile info drawer state. Only one tile can be expanded at a time —
    // otherwise grids tear vertically as rows grow inconsistently.
    const [expandedId, setExpandedId] = useState<string | null>(null)
    // Client-measured natural dimensions, keyed by image id. Filled lazily as
    // tiles' <img>s load — the backstop for legacy rows whose Mongo doc
    // predates the optimise pipeline persisting `width`/`height`. Drives both
    // the orientation filter and the dimensions row in the info panel.
    const [measured, setMeasured] = useState<Record<string, {w: number; h: number}>>({})
    // Per-image alt + tag overrides — see `META_OVERRIDE_KEY`.
    const [metaOverrides, setMetaOverrides] = useState<Record<string, MetaOverride>>(() => readMetaOverrides())
    // Bulk-select state — mirrors the ImageRail UX so multi-delete works the
    // same way in either entry point (rail = sidebar dock, this modal =
    // legacy picker). `selectMode` is derived from `selected.size > 0` so
    // the operator enters/leaves it implicitly by toggling the check circle.
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [bulkBusy, setBulkBusy] = useState(false)
    const [bulkOpen, setBulkOpen] = useState(false)
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
        if (fail === 0) notifySuccess(t('Deleted {{count}} images', {count: ok}) as string);
        else notifyWarning(t('Deleted {{ok}}, {{fail}} failed', {ok, fail}) as string);
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
            notifySuccess(String(t('Rescan complete: {{added}} added, {{skipped}} already known ({{total}} on disk)', r as any)))
            await loadImages()
        } catch (e: any) {
            notifyError(e)
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

    // Round-trip sort + filter view-state through the page URL so a reload
    // restores it. The picker is a modal, but `replaceState` on the host
    // page's URL (namespaced `pkr*` params) is the roadmap's "survives
    // reload" requirement met without a separate persistence store.
    useEffect(() => {
        syncUrlState({sort: sortMode, search: searchTag, hasTag: hasTagFilter, orientation: orientationFilter});
    }, [sortMode, searchTag, hasTagFilter, orientationFilter]);

    // Live search: debounce so the gallery filters as the user types instead
    // of requiring an explicit "Search Images" click.
    const onSearchChange = (v: string) => {
        setSearchTag(v)
        if (searchDebounce.current) clearTimeout(searchDebounce.current)
        searchDebounce.current = setTimeout(() => { void loadImages(v) }, 250)
    }

    // Record an <img>'s natural dimensions once it loads — the backstop the
    // orientation filter + info panel use for rows missing persisted dims.
    const onTileImgLoad = useCallback((id: string, el: HTMLImageElement) => {
        if (!id || !el.naturalWidth || !el.naturalHeight) return;
        setMeasured(prev => (
            prev[id] ? prev : {...prev, [id]: {w: el.naturalWidth, h: el.naturalHeight}}
        ));
    }, []);

    // Resolve the best-known dimensions for an image: persisted metadata
    // first, client-measured natural size second.
    const dimsOf = useCallback((image: IImage): {w?: number; h?: number} => {
        if (image.width && image.height) return {w: image.width, h: image.height};
        const m = measured[image.id];
        return m ? {w: m.w, h: m.h} : {};
    }, [measured]);

    // Persist (and reflect in state) a per-image alt / tag override.
    const updateMetaOverride = useCallback((id: string, patch: MetaOverride) => {
        setMetaOverrides(prev => {
            const next = {...prev, [id]: {...prev[id], ...patch}};
            writeMetaOverrides(next);
            return next;
        });
    }, []);

    // Effective tags for an image = override if present, else the stored tags.
    const tagsOf = useCallback((image: IImage): string[] => {
        const override = metaOverrides[image.id]?.tags;
        if (override) return override;
        return Array.isArray(image.tags) ? image.tags.filter(Boolean) as string[] : [];
    }, [metaOverrides]);

    // Sort + filter the already-fetched list. Filters run before sort so the
    // result count reflects what's actually shown.
    const visibleImages = useMemo(() => {
        let out = [...images];

        // has-tag filter — case-insensitive substring against effective tags.
        const needle = hasTagFilter.trim().toLowerCase();
        if (needle) {
            out = out.filter(img => tagsOf(img).some(tag => tag.toLowerCase().includes(needle)));
        }

        // orientation filter — uses persisted dims, falls back to measured.
        if (orientationFilter !== 'any') {
            out = out.filter(img => {
                const {w, h} = dimsOf(img);
                return orientationOf(w, h) === orientationFilter;
            });
        }

        if (sortMode === 'name') {
            out.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
        } else if (sortMode === 'size') {
            out.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
        } else if (sortMode === 'unused') {
            // Ascending usage — never-referenced images first. `usageCount`
            // is only present on the `listImagesWithUsage` path; when absent
            // every image scores equal and the sort is a stable no-op
            // (effectively `recent` order).
            out.sort((a, b) => (a.usageCount ?? 0) - (b.usageCount ?? 0));
        }
        return out;
    }, [images, sortMode, hasTagFilter, orientationFilter, tagsOf, dimsOf]);

    // Derived preview target — hovered tile wins, confirmed-selected fallback.
    const previewTarget = focusImage;
    const previewUrl = previewTarget ? `/${previewTarget.location}` : null;

    return (
        <div>
            <Button
                type={'primary'}
                data-testid="image-picker-open-button"
                onClick={() => {
                    setDialogOpen(true)
                }}
            >
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
                <div className={'image-upload'} data-image-picker-root data-testid="image-picker-modal">
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
                                <Tooltip title={t("Pick one image, crop and edit before saving.")}>
                                    <Button ref={buttonRef} type="primary" icon={<CloudUploadOutlined/>} data-testid="image-picker-upload-one-button">
                                        {t("Upload one image")}
                                    </Button>
                                </Tooltip>
                                <Tooltip title={t("Drop many files at once, or import from a URL (S3, Cloudinary, Unsplash, …). Server applies the same ratio + EXIF strip.")}>
                                    <Button
                                        icon={<CloudUploadOutlined/>}
                                        onClick={() => setBulkOpen(true)}
                                        data-testid="image-picker-upload-many-button"
                                    >
                                        {t("Upload many / from URL")}
                                    </Button>
                                </Tooltip>
                                <Tooltip title={t("Scan public/images on the server and add any files missing from the library.")}>
                                    <Button
                                        onClick={rescanDisk}
                                        loading={rescanning}
                                        icon={<ReloadOutlined/>}
                                        data-testid="image-picker-rescan-button"
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
                                data-testid="image-picker-search-input"
                            />
                            <Button onClick={() => loadImages()} data-testid="image-picker-search-button">{t("Search")}</Button>
                            <Select<SortMode>
                                value={sortMode}
                                style={{minWidth: 140}}
                                onChange={setSortMode}
                                data-testid="image-picker-sort-select"
                                options={[
                                    {value: 'recent', label: t('Sort: recent')},
                                    {value: 'name', label: t('Sort: name')},
                                    {value: 'size', label: t('Sort: size')},
                                    {value: 'unused', label: t('Sort: unused')},
                                ]}
                            />
                            <Input
                                allowClear
                                placeholder={t("Has tag…")}
                                value={hasTagFilter}
                                style={{maxWidth: 150}}
                                onChange={(e) => setHasTagFilter(e.target.value)}
                                data-testid="image-picker-hastag-filter-input"
                            />
                            <Select<OrientationFilter>
                                value={orientationFilter}
                                style={{minWidth: 150}}
                                onChange={setOrientationFilter}
                                data-testid="image-picker-orientation-filter-select"
                                options={[
                                    {value: 'any', label: t('Any orientation')},
                                    {value: 'landscape', label: t('Landscape')},
                                    {value: 'portrait', label: t('Portrait')},
                                    {value: 'square', label: t('Square')},
                                ]}
                            />
                            <span className={'result-count'} data-testid="image-picker-result-count">
                                {t('{{count}} images', {count: visibleImages.length})}
                            </span>
                        </div>

                        {selectMode && (
                            <div
                                data-testid="image-picker-bulk-bar"
                                style={{
                                    padding: '6px 10px',
                                    margin: '0 0 8px 0',
                                    background: '#e6f4ff',
                                    border: '1px solid #91caff',
                                    borderRadius: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: 13,
                                }}
                            >
                                <strong style={{flex: 1}}>{t('{{count}} selected', {count: selected.size})}</strong>
                                <Popconfirm
                                    title={t('Delete {{count}} images?', {count: selected.size})}
                                    description={t('The Mongo record is removed; the file on disk is kept.')}
                                    okText={t('Delete')}
                                    cancelText={t('Cancel')}
                                    okButtonProps={{danger: true, loading: bulkBusy}}
                                    onConfirm={bulkDelete}
                                >
                                    <Button danger size="small" icon={<DeleteOutlined/>} loading={bulkBusy} data-testid="image-picker-bulk-delete-button">
                                        {t('Delete')}
                                    </Button>
                                </Popconfirm>
                                <Button size="small" onClick={clearSelection} disabled={bulkBusy} data-testid="image-picker-bulk-clear-button">
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
                                {visibleImages.length === 0 && (
                                    <div style={{gridColumn: '1 / -1'}}>
                                        <Empty description={t("No images — upload one or click 'Rescan Disk'.")}/>
                                    </div>
                                )}
                                {visibleImages.map((image: IImage, index) => {
                                    const src = `/${image.location}`
                                    const tileId = image.id ?? `${image.name}-${index}`;
                                    const isExpanded = expandedId === tileId;
                                    const isSelected = selected.has(image.id);
                                    const {w, h} = dimsOf(image);
                                    const effectiveTags = tagsOf(image);
                                    const effectiveAlt = metaOverrides[image.id]?.alt ?? image.alt ?? '';
                                    return (
                                        <div
                                            className={`image-item${isExpanded ? ' is-expanded' : ''}${isSelected ? ' is-selected' : ''}`}
                                            key={tileId}
                                            data-testid={`image-picker-tile-${image.id}`}
                                            data-state={isExpanded ? 'expanded' : 'collapsed'}
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
                                                alt={effectiveAlt || image.name}
                                                className={'image-item__thumb'}
                                                loading="lazy"
                                                onLoad={(e) => onTileImgLoad(image.id, e.currentTarget)}
                                                style={isSelected ? {filter: 'brightness(0.92)'} : undefined}
                                            />

                                            {/* Top-left select-toggle. Always shown so the affordance
                                                is discoverable without a hover (mobile / touchpad
                                                hover is unreliable inside the modal); the dark
                                                backdrop keeps it readable on any photo. */}
                                            <button
                                                type="button"
                                                aria-label={isSelected ? t('Deselect image') as string : t('Select image') as string}
                                                data-testid={`image-picker-tile-select-${image.id}`}
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
                                                    {/* Info chevron — keyboard-accessible: it's a real
                                                        <button> so Enter/Space toggle the details panel
                                                        natively. `aria-expanded` mirrors `data-state`
                                                        on the tile so e2e can assert either. */}
                                                    <Button
                                                        size="small"
                                                        shape="circle"
                                                        type={isExpanded ? 'primary' : 'default'}
                                                        icon={<InfoCircleOutlined/>}
                                                        onClick={() => setExpandedId(isExpanded ? null : tileId)}
                                                        aria-label={t('More info')}
                                                        aria-expanded={isExpanded}
                                                        data-testid={`image-picker-tile-info-toggle-${image.id}`}
                                                    />
                                                </Tooltip>
                                                <Tooltip title={t("Preview")}>
                                                    <Button
                                                        size="small"
                                                        shape="circle"
                                                        icon={<EyeOutlined/>}
                                                        onClick={() => setPreviewSrc(src)}
                                                        aria-label={t('Preview')}
                                                        data-testid={`image-picker-tile-preview-${image.id}`}
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
                                                        <Button size="small" shape="circle" danger icon={<DeleteOutlined/>} aria-label={t('Delete')} data-testid={`image-picker-tile-delete-${image.id}`}/>
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
                                                    data-testid={`image-picker-tile-details-${image.id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                >
                                                    <div><strong>{t('File')}:</strong> {image.name}</div>
                                                    <div>
                                                        <strong>{t('Dimensions')}:</strong>{' '}
                                                        {w && h ? `${w} × ${h}` : '—'}
                                                    </div>
                                                    <div><strong>{t('Size')}:</strong> {formatBytes(image.sizeBytes ?? image.size)}</div>
                                                    <div><strong>{t('Type')}:</strong> {image.type || '—'}</div>
                                                    <div><strong>{t('Uploaded by')}:</strong> {image.uploadedBy || '—'}</div>
                                                    <div><strong>{t('Added')}:</strong> {image.uploadedAt || image.created || '—'}</div>
                                                    <div>
                                                        <strong>{t('Used in')}:</strong>{' '}
                                                        {typeof image.usageCount === 'number'
                                                            ? t('{{count}} place(s)', {count: image.usageCount})
                                                            : '—'}
                                                    </div>
                                                    <div style={{marginTop: 6}}>
                                                        <label className={'field-label'} htmlFor={`alt-${image.id}`}>
                                                            {t('Alt text')}
                                                        </label>
                                                        <Input
                                                            id={`alt-${image.id}`}
                                                            size="small"
                                                            value={effectiveAlt}
                                                            placeholder={t('Describe the image for screen readers')}
                                                            data-testid={`image-picker-tile-alt-input-${image.id}`}
                                                            onChange={(e) => updateMetaOverride(image.id, {alt: e.target.value})}
                                                        />
                                                    </div>
                                                    <div style={{marginTop: 6}}>
                                                        <label className={'field-label'}>{t('Tags')}</label>
                                                        <Select
                                                            mode="tags"
                                                            size="small"
                                                            style={{width: '100%'}}
                                                            value={effectiveTags}
                                                            placeholder={t('Add tags')}
                                                            data-testid={`image-picker-tile-tags-select-${image.id}`}
                                                            onChange={(tags: string[]) => updateMetaOverride(image.id, {tags})}
                                                        />
                                                    </div>
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
                            <aside className={'image-preview-panel'} data-testid="image-picker-preview-panel">
                                <div className={'field-hint'} style={{marginBottom: 6}}>{t("Preview")}</div>
                                <div className={'image-preview-panel__box'} data-testid="image-picker-preview-box">
                                    {previewUrl ? (
                                        <img src={previewUrl} alt={previewTarget?.name ?? ''}/>
                                    ) : (
                                        <div className={'image-preview-panel__placeholder'}>
                                            {t('Hover or focus a tile')}
                                        </div>
                                    )}
                                </div>
                                {previewTarget && (
                                    <div className={'image-preview-panel__meta'} data-testid="image-picker-preview-meta">
                                        <div className={'image-preview-panel__name'} title={previewTarget.name}>
                                            {previewTarget.name}
                                        </div>
                                        <div className={'image-preview-panel__size'}>
                                            {formatBytes(previewTarget.sizeBytes ?? previewTarget.size)}
                                            {previewTarget.type ? ` · ${previewTarget.type.replace('image/', '')}` : ''}
                                            {(() => {
                                                const {w, h} = dimsOf(previewTarget);
                                                return w && h ? ` · ${w}×${h}` : '';
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </aside>
                        </div>

                    </div>
                </div>
            </Modal>
            <BulkImageUploadModal
                open={bulkOpen}
                onClose={() => setBulkOpen(false)}
                onUploaded={async () => { await loadImages(); }}
                t={t}
            />
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
