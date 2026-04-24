import {Button, Input, Select, Space, Typography} from "antd";
import React from "react";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {GalleryContent, IGalleryItem} from "@client/modules/Gallery";
import {GALLERY_ASPECT_RATIOS, GalleryAspectRatio} from "@client/modules/Gallery/Gallery.types";
import EditWrapper from "@client/lib/EditWrapper";
import ImageUpload from "@admin/lib/ImageUpload";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import {ImageDropPayload, useImageDrop} from "@client/lib/useImageDrop";

/**
 * Inline drop zone — hooks can't be called in a `.map()`, so each item
 * wraps its `useImageDrop` in its own tiny component. The dashed-outline
 * highlight only appears while a rail thumbnail is being dragged over.
 */
const ItemDropZone: React.FC<{
    onImage: (img: ImageDropPayload) => void;
    children: React.ReactNode;
}> = ({onImage, children}) => {
    const {dropHandlers, isDragOver} = useImageDrop(onImage);
    return (
        <div
            {...dropHandlers}
            style={isDragOver ? {outline: '2px dashed var(--theme-colorPrimary, #1677ff)', outlineOffset: 2, borderRadius: 4} : undefined}
        >
            {children}
        </div>
    );
};

const GalleryEditor = ({content, setContent, t}: IInputContent) => {
    const galleryContent = new GalleryContent(EItemType.Image, content);
    const data = galleryContent.data

    // Drop at the "add new" footer creates a fresh item with the dropped
    // image's src, mirroring the "Add New Image" button + immediate pick.
    const {dropHandlers: addDropHandlers, isDragOver: addDragOver} = useImageDrop((img) => {
        galleryContent.addItem();
        const items = galleryContent.data.items ?? [];
        const lastIndex = items.length - 1;
        if (lastIndex >= 0) {
            galleryContent.setItem(lastIndex, {...items[lastIndex], src: PUBLIC_IMAGE_PATH + img.name});
        }
        setContent(galleryContent.stringData);
    });

    const totalItems = data.items?.length ?? 0;

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
            </Space>
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
                                        <ItemDropZone onImage={onDropImage}>
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
                                        </ItemDropZone>
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
            <div
                className={'add-image-container'}
                {...addDropHandlers}
                style={addDragOver ? {outline: '2px dashed var(--theme-colorPrimary, #1677ff)', outlineOffset: 2, borderRadius: 4, padding: 8} : {padding: 8}}
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
            </div>
        </div>
    )
}

export default GalleryEditor
export {GalleryEditor};
