import {Button, Input, Switch, Tooltip} from "antd";
import React from "react";
import {IInputContent} from "../../../../Interfaces/IInputContent";
import {EItemType} from "../../../../enums/EItemType";
import {IGalleryItem} from "../../SectionComponents/Gallery";
import EditWrapper from "../../common/EditWrapper";
import ImageUpload from "../../ImageUpload";
import {CarouselContent} from "../../SectionComponents/CarouselView";
import {PUBLIC_IMAGE_PATH} from "../../../../constants/imgPath";

const InputCarousel = ({content, setContent, t}: IInputContent) => {
    const galleryContent = new CarouselContent(EItemType.Image, content);
    const data = galleryContent.data
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
                        return (
                            <EditWrapper t={t} key={index} wrapperClass={'config-item-container'} admin={true} del={true}
                                         deleteAction={async () => {
                                             galleryContent.removeItem(index)
                                             setContent(galleryContent.stringData)
                                         }}>
                                <div key={index} className={`container text-${item.textPosition}`}>
                                    <div className={'config-item'}>
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
            <div className={'add-image-container'}>
                <Button type="primary" onClick={() => {
                    galleryContent.addItem()
                    setContent(galleryContent.stringData)
                }}>
                    {t("Add new Image")}
                </Button>
            </div>
        </div>
    )
}

export default InputCarousel