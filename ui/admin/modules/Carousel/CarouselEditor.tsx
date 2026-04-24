import {Button, Input, Switch, Tooltip} from "antd";
import React from "react";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IGalleryItem} from "@client/modules/Gallery";
import EditWrapper from "@client/lib/EditWrapper";
import ImageUpload from "@admin/lib/ImageUpload";
import {CarouselContent} from "@client/modules/Carousel";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import {ImageDropPayload} from "@client/lib/useImageDrop";
import ImageDropTarget from "@client/lib/ImageDropTarget";

const CarouselEditor = ({content, setContent, t}: IInputContent) => {
    const galleryContent = new CarouselContent(EItemType.Image, content);
    const data = galleryContent.data
    const handleAppendFromDrop = (img: ImageDropPayload) => {
        galleryContent.addItem();
        const items = galleryContent.data.items ?? [];
        const lastIndex = items.length - 1;
        if (lastIndex >= 0) {
            galleryContent.setItem(lastIndex, {...items[lastIndex], src: PUBLIC_IMAGE_PATH + img.name});
        }
        setContent(galleryContent.stringData);
    };
    return (
        <div className={'admin gallery-wrapper'}>
            <div className={'config-item'}>
                <label>{t("Autoplay")}</label>
                <div className={'content'}>
                    <Switch value={galleryContent.data.autoplay} onChange={(checked) => {
                        galleryContent.setAutoplay(checked)
                        setContent(galleryContent.stringData)
                    }}/>
                </div>
            </div>
            <div className={'config-item'}>
                <Tooltip title="(In miliseconds - default = 3000)">
                    <label>{t("Autoplay speed")}</label>
                </Tooltip>
                <div className={'content'}>
                    <Input defaultValue={3000} value={galleryContent.data.autoplaySpeed} onChange={(e) => {
                        galleryContent.setAutoplaySpeed(parseInt(e.target.value))
                        setContent(galleryContent.stringData)
                    }}/>
                </div>
            </div>
            <div className={'config-item'}>
                <label>{t("Infinity")}</label>
                <div className={'content'}>

                    <Switch value={galleryContent.data.infinity} onChange={(checked) => {
                        galleryContent.setInfinity(checked)
                        setContent(galleryContent.stringData)
                    }}/>
                </div>
            </div>
            <div className={'config-item'}>
                <label>{t("Dots")}</label>
                <div className={'content'}>

                    <Switch value={galleryContent.data.dots} onChange={(checked) => {
                        galleryContent.setDots(checked)
                        setContent(galleryContent.stringData)
                    }}/>
                </div>
            </div>
            <div className={'config-item'}>
                <label>{t("Arrows")}</label>
                <div className={'content'}>
                    <Switch value={galleryContent.data.arrows} onChange={(checked) => {
                        galleryContent.setArrows(checked)
                        setContent(galleryContent.stringData)
                    }}/>
                </div>
            </div>
            <hr/>
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
                            <EditWrapper t={t} key={index} wrapperClass={'config-item-container'} admin={true} del={true}
                                         deleteAction={async () => {
                                             galleryContent.removeItem(index)
                                             setContent(galleryContent.stringData)
                                         }}>
                                <div key={index} className={`container text-${item.textPosition}`}>
                                    <div className={'config-item'}>
                                        <ImageDropTarget onImage={onDropImage} filled={!!item.src}>
                                            <div
                                                className={'select-image-container'}
                                                style={{display: 'flex', alignItems: 'center', gap: 10}}
                                            >
                                                {/* Inline thumbnail — GalleryEditor shows a preview
                                                    per tile but Carousel rows were text-input-only,
                                                    so authors had to cross-reference URLs against the
                                                    picker. Placing the <img> *inside*
                                                    `select-image-container` (row-flex) keeps it in
                                                    the upload control's band — the surrounding
                                                    `.config-item` is column-flex, so a standalone
                                                    thumbnail would spawn its own row and disappear
                                                    off the visible panel. */}
                                                {item.src && (
                                                    <img
                                                        src={`/${item.src}`}
                                                        alt={item.alt || ''}
                                                        style={{
                                                            width: 72,
                                                            height: 54,
                                                            objectFit: 'cover',
                                                            borderRadius: 3,
                                                            border: '1px solid #e4e4e4',
                                                            flexShrink: 0,
                                                            background: '#fafafa',
                                                        }}
                                                    />
                                                )}
                                                <ImageUpload t={t} setFile={setFile}/>
                                            </div>
                                            <div className={'content'}>
                                                <Input
                                                    placeholder={'Image URL'}
                                                    value={item.src}
                                                    disabled={true}
                                                />
                                            </div>
                                        </ImageDropTarget>
                                    </div>
                                    <div className={'config-item'}>
                                        <label>{t("Description")}:</label>
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
                hint={t("Drop to add to carousel")}
            >
                <Button type="primary" onClick={() => {
                    galleryContent.addItem()
                    setContent(galleryContent.stringData)
                }}>
                    {t("Add new Image")}
                </Button>
                <span style={{marginLeft: 12, fontSize: 11, color: '#888'}}>
                    {t("or drag an image here")}
                </span>
            </ImageDropTarget>
        </div>
    )
}

export {CarouselEditor};
export default CarouselEditor;
