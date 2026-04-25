import {Button, Input, Select, Space, Typography} from "antd";
import {CloudUploadOutlined, DeleteOutlined, DownOutlined, UpOutlined} from "@client/lib/icons";
import React, {useState} from "react";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {ETextPosition} from "@enums/ETextPosition";
import {GalleryContent, IGalleryItem} from "@client/modules/Gallery";
import {GALLERY_ASPECT_RATIOS, GalleryAspectRatio} from "@client/modules/Gallery/Gallery.types";
import ImageUpload from "@admin/lib/ImageUpload";
import BulkImageUploadModal, {BulkRatio} from "@admin/lib/BulkImageUploadModal";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import {ImageDropPayload} from "@client/lib/useImageDrop";
import ImageDropTarget from "@client/lib/ImageDropTarget";
import type IImage from "@interfaces/IImage";
import LinkTargetPicker from "@admin/lib/LinkTargetPicker";
import {normalizeCssDimension} from "@utils/stringFunctions";

/**
 * Gallery editor — reshaped to mirror the rendered gallery grid so the
 * admin view feels like "the same gallery, but editable":
 *
 *  - Items render as compact tile cards with a real thumbnail preview.
 *  - Required-ish controls (Set Image, reorder, delete) live on the tile.
 *  - Optional fields (Description, Image width / height, Link) are
 *    collapsed under a per-tile "Show more" toggle to keep the column
 *    skim-readable when an editor is just sequencing images.
 */

// CSS-in-JS for the editor-only grid. Keeping these inline avoids a sccs
// touch — the runtime gallery preview owns the public-facing styles.
const styles = {
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
        margin: '0 16px',
    } as React.CSSProperties,
    tile: {
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 6,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative' as const,
    } as React.CSSProperties,
    thumbWrap: {
        position: 'relative' as const,
        width: '100%',
        aspectRatio: '16 / 9',
        background: '#f5f5f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    } as React.CSSProperties,
    thumb: {
        width: '100%',
        height: '100%',
        objectFit: 'cover' as const,
        display: 'block',
    } as React.CSSProperties,
    thumbPlaceholder: {
        fontSize: 11,
        color: '#999',
    } as React.CSSProperties,
    tileBody: {
        padding: 8,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 6,
    } as React.CSSProperties,
    caption: {
        fontSize: 11,
        color: '#666',
        whiteSpace: 'nowrap' as const,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
    } as React.CSSProperties,
    actionsRow: {
        display: 'flex',
        gap: 4,
        flexWrap: 'wrap' as const,
        alignItems: 'center',
    } as React.CSSProperties,
    moreSection: {
        padding: '0 8px 8px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 6,
        borderTop: '1px dashed rgba(0,0,0,0.08)',
        marginTop: 4,
        paddingTop: 8,
    } as React.CSSProperties,
    fieldLabel: {
        fontSize: 11,
        color: '#888',
        marginBottom: 2,
    } as React.CSSProperties,
};

const fileNameFromSrc = (src: string | undefined): string => {
    if (!src) return '';
    const parts = src.split('/');
    return parts[parts.length - 1] || src;
};

// `normalizeCssDimension` lives in `@utils/stringFunctions` — shared with
// PlainImageEditor (and any other editor that surfaces free-form CSS
// width/height fields) so the "type a number, get px" behaviour is uniform.

const GalleryEditor = ({content, setContent, t}: IInputContent) => {
    const galleryContent = new GalleryContent(EItemType.Image, content);
    const data = galleryContent.data;

    // Per-tile "show more" state. Keyed by index — cheap and stable enough
    // for the editor's reorder/delete cadence (we don't preserve which
    // tile was expanded after a reorder; that'd surprise the operator more
    // than help).
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});
    const [bulkOpen, setBulkOpen] = useState(false);

    // Drop at the "add new" footer creates a fresh item with the dropped
    // image's src, mirroring the "Add New Image" button + immediate pick.
    const handleAppendFromDrop = (img: ImageDropPayload) => {
        galleryContent.addItem();
        const items = galleryContent.data.items ?? [];
        const lastIndex = items.length - 1;
        if (lastIndex >= 0) {
            galleryContent.setItem(lastIndex, {...items[lastIndex], src: PUBLIC_IMAGE_PATH + img.name});
        }
        setContent(galleryContent.stringData);
    };

    const totalItems = data.items?.length ?? 0;

    // Feed each successfully-uploaded image into the gallery as a new item.
    const handleBulkUploaded = (images: IImage[]) => {
        for (const img of images) {
            const src = img.location && img.location.startsWith(PUBLIC_IMAGE_PATH)
                ? img.location
                : `${PUBLIC_IMAGE_PATH}${img.name}`;
            galleryContent.addItem({
                src,
                alt: img.name ?? '',
                text: '',
                height: 0,
                preview: true,
                imgWidth: '',
                imgHeight: '',
                textPosition: ETextPosition.Bottom,
            });
        }
        setContent(galleryContent.stringData);
    };

    const toggleMore = (index: number) =>
        setExpanded(prev => ({...prev, [index]: !prev[index]}));

    return (
        <div className={'gallery-wrapper admin'}>
            {/* Gallery-level toolbar — aspect-ratio lock + bulk upload. */}
            <Space style={{margin: '0 16px 12px 16px', flexWrap: 'wrap'}} align="center">
                <Typography.Text strong>{t('Aspect ratio')}</Typography.Text>
                <Select<GalleryAspectRatio>
                    value={(data.aspectRatio ?? 'free')}
                    style={{minWidth: 120}}
                    onChange={(v) => {
                        galleryContent.setAspectRatio(v);
                        setContent(galleryContent.stringData);
                    }}
                    options={GALLERY_ASPECT_RATIOS.map((r) => ({value: r, label: r}))}
                />
                <Button icon={<CloudUploadOutlined/>} onClick={() => setBulkOpen(true)}>
                    {t('Bulk upload')}
                </Button>
            </Space>
            <BulkImageUploadModal
                open={bulkOpen}
                t={t}
                initialRatio={(data.aspectRatio ?? 'free') as BulkRatio}
                onClose={() => setBulkOpen(false)}
                onUploaded={(images) => {
                    handleBulkUploaded(images);
                    setBulkOpen(false);
                }}
            />

            {/* Tile grid — mirrors the rendered gallery so the editor view
                feels like "the same gallery, but editable". */}
            <div className={'images-container'} style={styles.grid}>
                {(data.items ?? []).map((item: IGalleryItem, index) => {
                    const setFile = (file: File) => {
                        galleryContent.setItem(index, {
                            ...item,
                            src: PUBLIC_IMAGE_PATH + file.name,
                        });
                        setContent(galleryContent.stringData);
                    };
                    const onDropImage = (img: ImageDropPayload) => {
                        galleryContent.setItem(index, {
                            ...item,
                            src: PUBLIC_IMAGE_PATH + img.name,
                        });
                        setContent(galleryContent.stringData);
                    };
                    const isExpanded = !!expanded[index];
                    // `item.src` is stored as `api/<file>` — the runtime
                    // gallery resolves that to `/api/<file>` (or Caddy in
                    // prod). Adding the leading slash here gives us a
                    // working preview in `next dev` too, where our local
                    // `pages/api/[name].ts` shim serves the bytes.
                    const previewUrl = item.src ? `/${item.src}` : null;

                    return (
                        <div key={index} style={styles.tile}>
                            <ImageDropTarget onImage={onDropImage} filled={!!item.src}>
                                <div style={styles.thumbWrap}>
                                    {previewUrl ? (
                                        <img
                                            src={previewUrl}
                                            alt={item.alt ?? ''}
                                            style={styles.thumb}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <span style={styles.thumbPlaceholder}>
                                            {t('No image')}
                                        </span>
                                    )}
                                </div>
                            </ImageDropTarget>

                            <div style={styles.tileBody}>
                                <div style={styles.caption} title={item.src}>
                                    {fileNameFromSrc(item.src) || t('Empty slot')}
                                </div>
                                <ImageUpload t={t} setFile={setFile}/>
                                <div style={styles.actionsRow}>
                                    <Button
                                        size="small"
                                        disabled={index === 0}
                                        aria-label={t('Move up')}
                                        icon={<UpOutlined/>}
                                        onClick={() => {
                                            galleryContent.moveItem(index, index - 1);
                                            setContent(galleryContent.stringData);
                                        }}
                                    />
                                    <Button
                                        size="small"
                                        disabled={index >= totalItems - 1}
                                        aria-label={t('Move down')}
                                        icon={<DownOutlined/>}
                                        onClick={() => {
                                            galleryContent.moveItem(index, index + 1);
                                            setContent(galleryContent.stringData);
                                        }}
                                    />
                                    <Button
                                        size="small"
                                        danger
                                        aria-label={t('Delete')}
                                        icon={<DeleteOutlined/>}
                                        onClick={() => {
                                            galleryContent.removeItem(index);
                                            setContent(galleryContent.stringData);
                                        }}
                                    />
                                    <Button
                                        size="small"
                                        type="link"
                                        style={{marginLeft: 'auto', padding: 0}}
                                        onClick={() => toggleMore(index)}
                                        aria-expanded={isExpanded}
                                    >
                                        {isExpanded ? t('Show less') : t('Show more')}
                                    </Button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div style={styles.moreSection}>
                                    <div>
                                        <div style={styles.fieldLabel}>{t('Description')}</div>
                                        <Input
                                            placeholder={t('Text')}
                                            value={item.text}
                                            onChange={({target: {value}}) => {
                                                galleryContent.setItem(index, {...item, text: value});
                                                setContent(galleryContent.stringData);
                                            }}
                                        />
                                    </div>
                                    <Space.Compact style={{width: '100%'}}>
                                        <Input
                                            placeholder={t('Image width')}
                                            value={item.imgWidth}
                                            onChange={({target: {value}}) => {
                                                galleryContent.setItem(index, {...item, imgWidth: value});
                                                setContent(galleryContent.stringData);
                                            }}
                                            // Auto-append `px` on blur when the operator
                                            // typed a bare number — otherwise CSS drops the
                                            // value and the size field appears to do nothing.
                                            onBlur={({target: {value}}) => {
                                                const norm = normalizeCssDimension(value);
                                                if (norm !== value) {
                                                    galleryContent.setItem(index, {...item, imgWidth: norm});
                                                    setContent(galleryContent.stringData);
                                                }
                                            }}
                                        />
                                        <Input
                                            placeholder={t('Image height')}
                                            value={item.imgHeight}
                                            onChange={({target: {value}}) => {
                                                galleryContent.setItem(index, {...item, imgHeight: value});
                                                setContent(galleryContent.stringData);
                                            }}
                                            onBlur={({target: {value}}) => {
                                                const norm = normalizeCssDimension(value);
                                                if (norm !== value) {
                                                    galleryContent.setItem(index, {...item, imgHeight: norm});
                                                    setContent(galleryContent.stringData);
                                                }
                                            }}
                                        />
                                    </Space.Compact>
                                    <div>
                                        <div style={styles.fieldLabel}>{t('Link (optional)')}</div>
                                        <LinkTargetPicker
                                            placeholder={'https://…'}
                                            value={item.href ?? ''}
                                            onChange={(value) => {
                                                galleryContent.setItem(index, {...item, href: value || undefined});
                                                setContent(galleryContent.stringData);
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <ImageDropTarget
                onImage={handleAppendFromDrop}
                className={'add-image-container'}
                style={{padding: 8, margin: '12px 16px 0'}}
                hint={t("Drop to add to gallery")}
            >
                <Button type="primary" onClick={() => {
                    galleryContent.addItem();
                    setContent(galleryContent.stringData);
                }}>
                    {t("Add New Image")}
                </Button>
                <span style={{marginLeft: 12, fontSize: 11, color: '#888'}}>
                    {t("or drag an image here")}
                </span>
            </ImageDropTarget>
        </div>
    );
};

export default GalleryEditor;
export {GalleryEditor};
