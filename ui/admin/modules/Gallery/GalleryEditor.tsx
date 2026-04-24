import {Button, Input} from "antd";
import React from "react";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {GalleryContent, IGalleryItem} from "@client/modules/Gallery";
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

    return (
        <div className={'gallery-wrapper admin'}>
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
