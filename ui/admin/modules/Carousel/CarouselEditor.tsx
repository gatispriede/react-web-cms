import {Button, Input, Switch, Tooltip} from "antd";
import React from "react";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IGalleryItem} from "@client/modules/Gallery";
import EditWrapper from "@client/lib/EditWrapper";
import ImageUpload from "@admin/lib/ImageUpload";
import {CarouselContent} from "@client/modules/Carousel";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import {ImageDropPayload, useImageDrop} from "@client/lib/useImageDrop";

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

const CarouselEditor = ({content, setContent, t}: IInputContent) => {
    const galleryContent = new CarouselContent(EItemType.Image, content);
    const data = galleryContent.data
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
                                        <ItemDropZone onImage={onDropImage}>
                                            <div className={'select-image-container'}>
                                                <ImageUpload t={t} setFile={setFile}/>
                                            </div>
                                            <div className={'content'}>
                                                <Input
                                                    placeholder={'Image URL'}
                                                    value={item.src}
                                                    disabled={true}
                                                />
                                            </div>
                                        </ItemDropZone>
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
            <div
                className={'add-image-container'}
                {...addDropHandlers}
                style={addDragOver ? {outline: '2px dashed var(--theme-colorPrimary, #1677ff)', outlineOffset: 2, borderRadius: 4, padding: 8} : {padding: 8}}
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
            </div>
        </div>
    )
}

export {CarouselEditor};
export default CarouselEditor;
