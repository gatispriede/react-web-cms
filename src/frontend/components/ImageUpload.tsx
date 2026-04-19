import {Alert, Button, Empty, Image as AntImage, Input, message, Modal, Popconfirm, Space, Tooltip} from "antd";
import {CloudUploadOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined, SearchOutlined} from "./common/icons";
import React, {RefObject, useEffect, useRef, useState} from "react";
import UpploadManager from "../Classes/UpploadeManager";
import EditableTags from "./common/EditableTags";
import MongoApi from "../api/MongoApi";
import {TFunction} from "i18next";
import IImage from "../../Interfaces/IImage";
import {useRefreshView} from "../lib/refreshBus";

const ImageUpload = ({setFile, t}: { setFile: (file: File) => void, t: TFunction<"translation", undefined> }) => {

    let upploadManager: UpploadManager;
    const mongoApi = new MongoApi()

    const imageRef: RefObject<HTMLImageElement | null> = React.createRef();
    const buttonRef: RefObject<HTMLButtonElement | null> = React.createRef();

    const [error, setErrorState] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [images, setImages] = useState<IImage[]>([])
    const [searchTag, setSearchTag] = useState('')
    const [rescanning, setRescanning] = useState(false)
    const [previewSrc, setPreviewSrc] = useState<string | null>(null)
    const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        if (upploadManager) {
            upploadManager.setTags(tags);
        }
    }
    const loadImages = async (override?: string) => {
        const raw = override ?? searchTag
        const tag = raw && raw.trim().length > 0 ? raw.trim() : 'All'
        const imgs: IImage[] = await mongoApi.getImages(tag)
        setImages(imgs)
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

    useEffect(() => {
        if (imageRef.current && buttonRef.current) {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            upploadManager = new UpploadManager(imageRef.current, buttonRef.current, cb, setError);
            void loadImages()
        }
    }, [window, imageRef.current, buttonRef.current, dialogOpen])
    useRefreshView(loadImages, 'assets');

    // Live search: debounce so the gallery filters as the user types instead
    // of requiring an explicit "Search Images" click.
    const onSearchChange = (v: string) => {
        setSearchTag(v)
        if (searchDebounce.current) clearTimeout(searchDebounce.current)
        searchDebounce.current = setTimeout(() => { void loadImages(v) }, 250)
    }

    return (
        <div>
            <Button type={'primary'} onClick={() => {
                setDialogOpen(true)
            }}>
                {t("Select Image")}
            </Button>
            <Modal
                width={'min(1100px, 95vw)'}
                title={t('Image Selection')}
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

                    <div className={'upload-image-container'} style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) 220px',
                        gap: 16,
                        alignItems: 'start',
                        padding: 12,
                        border: '1px dashed #d9d9d9',
                        borderRadius: 8,
                    }}>
                        <div>
                            <div className={'tag-container'} style={{marginBottom: 12}}>
                                <label style={{display: 'block', fontWeight: 500, marginBottom: 6}}>
                                    {t("Tags applied to next upload")}
                                </label>
                                <EditableTags setTagsProp={(tags: string[]) => setTags(tags)}/>
                                <div style={{fontSize: 12, color: '#888', marginTop: 4}}>
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
                        <div className={'image-preview'} style={{textAlign: 'center'}}>
                            <div style={{fontSize: 12, color: '#888', marginBottom: 4}}>{t("Image Preview")}</div>
                            <img
                                ref={imageRef}
                                alt=""
                                className="uppload-image"
                                style={{maxWidth: '100%', maxHeight: 140, borderRadius: 6, background: '#fafafa'}}
                            />
                        </div>
                    </div>

                    <div className={'image-select-container'} style={{marginTop: 16}}>
                        <div className={'image-search-container'} style={{
                            display: 'flex',
                            gap: 8,
                            alignItems: 'center',
                            marginBottom: 12,
                        }}>
                            <Input
                                allowClear
                                prefix={<SearchOutlined/>}
                                placeholder={t("Filter by tag (leave empty for all)")}
                                value={searchTag}
                                onChange={(e) => onSearchChange(e.target.value)}
                                onPressEnter={() => loadImages()}
                            />
                            <Button onClick={() => loadImages()}>{t("Search")}</Button>
                            <span style={{fontSize: 12, color: '#888', whiteSpace: 'nowrap'}}>
                                {t('{{count}} images', {count: images.length})}
                            </span>
                        </div>

                        <div className={'image-result-container'} style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                            gap: 8,
                            maxHeight: '65vh',
                            overflowY: 'auto',
                            padding: 2,
                        }}>
                            {images.length === 0 && (
                                <div style={{gridColumn: '1 / -1'}}>
                                    <Empty description={t("No images — upload one or click 'Rescan Disk'.")}/>
                                </div>
                            )}
                            {images.map((image: IImage, index) => {
                                const src = `/${image.location}`
                                return (
                                    <div className={'image-item'} key={image.id ?? index} style={{
                                        position: 'relative',
                                        border: '1px solid #eee',
                                        borderRadius: 6,
                                        overflow: 'hidden',
                                        background: '#fafafa',
                                        aspectRatio: '1 / 1',
                                        cursor: 'pointer',
                                    }}
                                    onClick={() => {
                                        setFile(image as unknown as File)
                                        setDialogOpen(false)
                                    }}
                                    onMouseEnter={(e) => {
                                        const overlay = e.currentTarget.querySelector<HTMLElement>('[data-role="hover"]')
                                        if (overlay) overlay.style.opacity = '1'
                                    }}
                                    onMouseLeave={(e) => {
                                        const overlay = e.currentTarget.querySelector<HTMLElement>('[data-role="hover"]')
                                        if (overlay) overlay.style.opacity = '0'
                                    }}>
                                        <img
                                            src={src}
                                            alt={image.name}
                                            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
                                        />

                                        <div style={{
                                            position: 'absolute',
                                            top: 6,
                                            right: 6,
                                            display: 'flex',
                                            gap: 4,
                                            zIndex: 2,
                                        }} onClick={(e) => e.stopPropagation()}>
                                            <Tooltip title={t("Preview")}>
                                                <Button
                                                    size="small"
                                                    shape="circle"
                                                    icon={<EyeOutlined/>}
                                                    onClick={() => setPreviewSrc(src)}
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
                                                    <Button size="small" shape="circle" danger icon={<DeleteOutlined/>}/>
                                                </Tooltip>
                                            </Popconfirm>
                                        </div>

                                        <div
                                            data-role="hover"
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                right: 0,
                                                bottom: 0,
                                                padding: '18px 8px 6px',
                                                background: 'linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))',
                                                color: '#fff',
                                                fontSize: 11,
                                                opacity: 0,
                                                transition: 'opacity 120ms ease-out',
                                                pointerEvents: 'none',
                                            }}
                                            title={image.name}
                                        >
                                            <div style={{
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                            }}>{image.name}</div>
                                            <div style={{fontSize: 10, opacity: 0.85}}>{t("Click to select")}</div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

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
                </div>
            </Modal>
        </div>
    )
}

export default ImageUpload
