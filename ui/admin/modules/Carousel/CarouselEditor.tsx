import {Button, Input, Switch, Tooltip} from "antd";
import React, {useState} from "react";
import {IInputContent} from "@interfaces/IInputContent";
import {EItemType} from "@enums/EItemType";
import {IGalleryItem} from "@client/modules/Gallery";
import EditWrapper from "@client/lib/EditWrapper";
import {CarouselContent} from "@client/modules/Carousel";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import {ImageDropPayload} from "@client/lib/useImageDrop";
import ImageDropTarget from "@client/lib/ImageDropTarget";
import ImageRefInput from "@admin/lib/ImageRefInput";

const CarouselEditor = ({content, setContent, t}: IInputContent) => {
    const galleryContent = new CarouselContent(EItemType.Image, content);
    const data = galleryContent.data
    const hasAdvanced = !!(
        data.autoplay ||
        (data.autoplaySpeed && data.autoplaySpeed !== 3000) ||
        data.infinity ||
        data.dots ||
        data.arrows
    );
    const [showAdvanced, setShowAdvanced] = useState<boolean>(hasAdvanced);
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
    return (
        <div className={'admin gallery-wrapper'}>
            <div style={{marginBottom: 8}}>
                <Button
                    type="link"
                    size="small"
                    style={{padding: 0}}
                    onClick={() => setShowAdvanced(v => !v)}
                    aria-expanded={showAdvanced}
                >
                    {showAdvanced ? t('Hide playback options') : t('Show playback options')}
                </Button>
            </div>
            {showAdvanced && (
                <>
                    <div className={'config-item'}>
                        <label>{t("Autoplay")}</label>
                        <div className={'content'}>
                            <Switch value={data.autoplay} onChange={(checked) => {
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
                            <Input defaultValue={3000} value={data.autoplaySpeed} onChange={(e) => {
                                galleryContent.setAutoplaySpeed(parseInt(e.target.value))
                                setContent(galleryContent.stringData)
                            }}/>
                        </div>
                    </div>
                    <div className={'config-item'}>
                        <label>{t("Infinity")}</label>
                        <div className={'content'}>
                            <Switch value={data.infinity} onChange={(checked) => {
                                galleryContent.setInfinity(checked)
                                setContent(galleryContent.stringData)
                            }}/>
                        </div>
                    </div>
                    <div className={'config-item'}>
                        <label>{t("Dots")}</label>
                        <div className={'content'}>
                            <Switch value={data.dots} onChange={(checked) => {
                                galleryContent.setDots(checked)
                                setContent(galleryContent.stringData)
                            }}/>
                        </div>
                    </div>
                    <div className={'config-item'}>
                        <label>{t("Arrows")}</label>
                        <div className={'content'}>
                            <Switch value={data.arrows} onChange={(checked) => {
                                galleryContent.setArrows(checked)
                                setContent(galleryContent.stringData)
                            }}/>
                        </div>
                    </div>
                </>
            )}
            <hr/>
            <div className={'images-container'}>
                {
                    data.items && data.items.map((item: IGalleryItem, index) => {
                        const onDropImage = (img: ImageDropPayload) => {
                            galleryContent.setItem(index, {
                                ...item,
                                image: {...item.image, src: PUBLIC_IMAGE_PATH + img.name},
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
                                        <ImageDropTarget onImage={onDropImage} filled={!!item.image.src}>
                                            <div
                                                className={'select-image-container'}
                                                style={{display: 'flex', alignItems: 'center', gap: 10}}
                                            >
                                                {item.image.src && (
                                                    <img
                                                        src={`/${item.image.src}`}
                                                        alt={item.image.alt || ''}
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
                                                <div style={{flex: 1}}>
                                                    <ImageRefInput
                                                        t={t}
                                                        value={item.image}
                                                        onChange={(image) => {
                                                            galleryContent.setItem(index, {...item, image});
                                                            setContent(galleryContent.stringData);
                                                        }}
                                                    />
                                                </div>
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
