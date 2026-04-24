import {Button, Input, Select, Space, Typography} from "antd";
import {CloudUploadOutlined} from "@client/lib/icons";
import React, {useState} from "react";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {ETextPosition} from "@enums/ETextPosition";
import {GalleryContent, IGalleryItem} from "@client/modules/Gallery";
import {GALLERY_ASPECT_RATIOS, GalleryAspectRatio} from "@client/modules/Gallery/Gallery.types";
import EditWrapper from "@client/lib/EditWrapper";
import ImageUpload from "@admin/lib/ImageUpload";
import BulkImageUploadModal, {BulkRatio} from "@admin/lib/BulkImageUploadModal";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import {ImageDropPayload} from "@client/lib/useImageDrop";
import ImageDropTarget from "@client/lib/ImageDropTarget";
import type IImage from "@interfaces/IImage";

const GalleryEditor = ({content, setContent, t}: IInputContent) => {
    const galleryContent = new GalleryContent(EItemType.Image, content);
    const data = galleryContent.data

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
    const [bulkOpen, setBulkOpen] = useState(false);

    // Feed each successfully-uploaded image into the gallery as a new item.
    // We re-read `data.items` inside the callback because prior state on
    // `galleryContent` is stale once the modal ran server-side work.
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

    return (
        <div className={'gallery-wrapper admin'}>
            {/* Gallery-level controls — currently the aspect-ratio lock (C6).
                Sits above the item list so operators see the uniform-crop
                promise before they start populating. `free` means no lock
                and keeps historical per-style defaults. */}
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
                {/* Bulk upload — opens a modal wired to /api/upload-batch.
                    Pre-fills the gallery's current aspectRatio so phone-shot
                    dumps land uniformly without a second step. */}
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
            <div className={'images-container'}>
                {
                    data.items && data.items.map((item: IGalleryItem, index) => {
                        const setFile = (file: File) => {
                            galleryContent.setItem(index, {
                                ...item,
                                src: PUBLIC_IMAGE_PATH + file.name
                            })
                            setContent(galleryContent.stringData)
                        }
                        const onDropImage = (img: ImageDropPayload) => {
                            galleryContent.setItem(index, {
                                ...item,
                                src: PUBLIC_IMAGE_PATH + img.name
                            });
                            setContent(galleryContent.stringData);
                        };
                        return (
                            <EditWrapper t={t} key={index} wrapperClass={'config-item-container'} admin={true} del={true} deleteAction={async () => {
                                galleryContent.removeItem(index)
                                setContent(galleryContent.stringData)
                            }}>
                                <div key={index} className={`admin container text-${item.textPosition}`}>
                                    <div className={'config-item'}>
                                        <ImageDropTarget onImage={onDropImage} filled={!!item.src}>
                                            <div className={'select-image-container'}>
                                                <ImageUpload t={t} setFile={setFile}/>
                                            </div>
                                            <div className={'content'}>
                                                <Input
                                                    placeholder={t("Image URL")}
                                                    value={item.src}
                                                    disabled={true}
                                                />
                                            </div>
                                        </ImageDropTarget>
                                    </div>
                                    <div className={'config-item'}>
                                        <label>Description</label>
                                        <div className={'content'}>

                                            <Input
                                                placeholder={'Text'}
                                                value={item.text}
                                                onChange={({target: {value}}) => {
                                                    galleryContent.setItem(index, {
                                                        ...item,
                                                        text: value
                                                    })
                                                    setContent(galleryContent.stringData)
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className={'config-item'}>
                                        <label>{t("Image width")}</label>
                                        <div className={'content'}>
                                            <Input
                                                placeholder={'Image width'}
                                                value={item.imgWidth}
                                                onChange={({target: {value}}) => {
                                                    galleryContent.setItem(index, {
                                                        ...item,
                                                        imgWidth: value
                                                    })
                                                    setContent(galleryContent.stringData)
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className={'config-item'}>
                                        <label>{t("Image Height")}</label>
                                        <div className={'content'}>

                                            <Input
                                                placeholder={'Image height'}
                                                value={item.imgHeight}
                                                onChange={({target: {value}}) => {
                                                    galleryContent.setItem(index, {
                                                        ...item,
                                                        imgHeight: value
                                                    })
                                                    setContent(galleryContent.stringData)
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className={'config-item'}>
                                        <label>{t("Link (optional)")}</label>
                                        <div className={'content'}>
                                            <Input
                                                placeholder={'https://…'}
                                                value={item.href ?? ''}
                                                onChange={({target: {value}}) => {
                                                    galleryContent.setItem(index, {
                                                        ...item,
                                                        href: value || undefined,
                                                    })
                                                    setContent(galleryContent.stringData)
                                                }}
                                            />
                                        </div>
                                    </div>
                                    {/* Reorder — simple up/down swap. Buttons are
                                        keyboard-focusable, so Tab + Enter moves
                                        tiles without a pointer. */}
                                    <Space style={{padding: '0 8px 8px'}}>
                                        <Button
                                            size="small"
                                            disabled={index === 0}
                                            aria-label={t('Move up')}
                                            onClick={() => {
                                                galleryContent.moveItem(index, index - 1);
                                                setContent(galleryContent.stringData);
                                            }}
                                        >↑ {t('Up')}</Button>
                                        <Button
                                            size="small"
                                            disabled={index >= totalItems - 1}
                                            aria-label={t('Move down')}
                                            onClick={() => {
                                                galleryContent.moveItem(index, index + 1);
                                                setContent(galleryContent.stringData);
                                            }}
                                        >↓ {t('Down')}</Button>
                                    </Space>
                                    <hr/>

                                </div>
                            </EditWrapper>
                        )
                    })
                }
            </div>
            <ImageDropTarget
                onImage={handleAppendFromDrop}
                className={'add-image-container'}
                style={{padding: 8}}
                hint={t("Drop to add to gallery")}
            >
                <Button type="primary" onClick={() => {
                    galleryContent.addItem()
                    setContent(galleryContent.stringData)
                }}>
                    {t("Add New Image")}
                </Button>
                <span style={{marginLeft: 12, fontSize: 11, color: '#888'}}>
                    {t("or drag an image here")}
                </span>
            </ImageDropTarget>
        </div>
    )
}

export default GalleryEditor
export {GalleryEditor};
