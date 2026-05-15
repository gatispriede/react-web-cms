import {Button, Input, Select, Space, Switch, Tooltip, Typography} from "antd";
import {CloudUploadOutlined, DeleteOutlined, DownOutlined, UpOutlined} from "@client/lib/icons";
import React, {useState} from "react";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {ETextPosition} from "@enums/ETextPosition";
import {GalleryContent, IGalleryItem} from "@client/modules/Gallery";
import {GALLERY_ASPECT_RATIOS, GalleryAspectRatio} from "@client/modules/Gallery/Gallery.types";
import BulkImageUploadModal, {BulkRatio} from "@admin/lib/BulkImageUploadModal";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import {ImageDropPayload} from "@client/lib/useImageDrop";
import ImageDropTarget from "@client/lib/ImageDropTarget";
import type IImage from "@interfaces/IImage";
import ImageRefInput from "@admin/lib/ImageRefInput";
import LinkRefInput from "@admin/lib/LinkRefInput";

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

const GalleryEditor = ({content, setContent, t}: IInputContent) => {
    const galleryContent = new GalleryContent(EItemType.Image, content);
    const data = galleryContent.data;

    const [expanded, setExpanded] = useState<Record<number, boolean>>({});
    const [bulkOpen, setBulkOpen] = useState(false);

    const handleAppendFromDrop = (img: ImageDropPayload) => {
        galleryContent.addItem();
        const items = galleryContent.data.items ?? [];
        const lastIndex = items.length - 1;
        if (lastIndex >= 0) {
            const cur = items[lastIndex];
            galleryContent.setItem(lastIndex, {...cur, image: {...cur.image, src: PUBLIC_IMAGE_PATH + img.name}});
        }
        setContent(galleryContent.stringData);
    };

    const totalItems = data.items?.length ?? 0;

    const handleBulkUploaded = (images: IImage[]) => {
        for (const img of images) {
            const src = img.location && img.location.startsWith(PUBLIC_IMAGE_PATH)
                ? img.location
                : `${PUBLIC_IMAGE_PATH}${img.name}`;
            galleryContent.addItem({
                image: {src, alt: img.name ?? undefined},
                preview: true,
                text: '',
                textPosition: ETextPosition.Bottom,
            });
        }
        setContent(galleryContent.stringData);
    };

    const toggleMore = (index: number) =>
        setExpanded(prev => ({...prev, [index]: !prev[index]}));

    return (
        <div className={'gallery-wrapper admin'}>
            <Space style={{margin: '0 16px 12px 16px', flexWrap: 'wrap'}} align="center">
                <Typography.Text strong>{t('Aspect ratio')}</Typography.Text>
                <Select<GalleryAspectRatio>
                    data-testid="gallery-editor-aspect-ratio-select"
                    value={(data.aspectRatio ?? 'free')}
                    style={{minWidth: 120}}
                    onChange={(v) => {
                        galleryContent.setAspectRatio(v);
                        setContent(galleryContent.stringData);
                    }}
                    options={GALLERY_ASPECT_RATIOS.map((r) => ({value: r, label: r}))}
                />
                <Button
                    data-testid="gallery-editor-bulk-upload-button"
                    icon={<CloudUploadOutlined/>}
                    onClick={() => setBulkOpen(true)}
                >
                    {t('Bulk upload')}
                </Button>
                <Tooltip title={t('Show each image’s alt text as a caption, with the description as a secondary line')}>
                    <Space size={6}>
                        <Switch
                            data-testid="gallery-editor-show-captions-switch"
                            size="small"
                            checked={data.showCaptions !== false}
                            onChange={(checked) => {
                                galleryContent.setShowCaptions(checked);
                                setContent(galleryContent.stringData);
                            }}
                        />
                        <Typography.Text>{t('Captions')}</Typography.Text>
                    </Space>
                </Tooltip>
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

            <div className={'images-container'} style={styles.grid}>
                {(data.items ?? []).map((item: IGalleryItem, index) => {
                    const onDropImage = (img: ImageDropPayload) => {
                        galleryContent.setItem(index, {
                            ...item,
                            image: {...item.image, src: PUBLIC_IMAGE_PATH + img.name},
                        });
                        setContent(galleryContent.stringData);
                    };
                    const isExpanded = !!expanded[index];
                    const previewUrl = item.image.src ? `/${item.image.src}` : null;

                    return (
                        <div key={index} style={styles.tile}>
                            <ImageDropTarget onImage={onDropImage} filled={!!item.image.src}>
                                <div style={styles.thumbWrap}>
                                    {previewUrl ? (
                                        <img
                                            src={previewUrl}
                                            alt={item.image.alt ?? ''}
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
                                <div style={styles.caption} title={item.image.src}>
                                    {fileNameFromSrc(item.image.src) || t('Empty slot')}
                                </div>
                                <ImageRefInput
                                    t={t}
                                    value={item.image}
                                    onChange={(image) => {
                                        galleryContent.setItem(index, {...item, image});
                                        setContent(galleryContent.stringData);
                                    }}
                                    hideAlt
                                />
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
                                    <div>
                                        <div style={styles.fieldLabel}>{t('Link (optional)')}</div>
                                        <LinkRefInput
                                            t={t}
                                            hostId={`gallery-item-${index}`}
                                            value={item.link ?? {url: ''}}
                                            onChange={(link) => {
                                                galleryContent.setItem(index, {
                                                    ...item,
                                                    link: link.url ? link : undefined,
                                                });
                                                setContent(galleryContent.stringData);
                                            }}
                                            placeholder={'https://…'}
                                            hideLabel
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
