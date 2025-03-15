import {Button, Input, Switch, Tooltip} from "antd";
import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {EItemType} from "../../../enums/EItemType";
import {IGalleryItem} from "../SectionComponents/Gallery";
import EditWrapper from "../common/EditWrapper";
import ImageUpload from "../ImageUpload";
import {CarouselContent} from "../SectionComponents/CarouselView";
import {PUBLIC_IMAGE_PATH} from "../../../constants/imgPath";

const InputCarousel = ({content, setContent}: IInputContent) => {
    const galleryContent = new CarouselContent(EItemType.Image, content);
    const data = galleryContent.data
    return (
        <div className={'admin gallery-wrapper'}>
            <div className={'config-item'}>
                <label>Autoplay</label>
                <Switch value={galleryContent.data.autoplay} onChange={(checked) => {
                    galleryContent.setAutoplay(checked)
                    setContent(galleryContent.stringData)
                }}/>
            </div>
            <div className={'config-item'}>
                <Tooltip title="(In miliseconds - default = 3000)">
                    <label>Autoplay speed</label>
                </Tooltip>
                <Input defaultValue={3000} value={galleryContent.data.autoplaySpeed} onChange={(e) => {
                    galleryContent.setAutoplaySpeed(parseInt(e.target.value))
                    setContent(galleryContent.stringData)
                }}/>
            </div>
            <div className={'config-item'}>
                <label>Infinity</label>
                <Switch value={galleryContent.data.infinity} onChange={(checked) => {
                    galleryContent.setInfinity(checked)
                    setContent(galleryContent.stringData)
                }}/>
            </div>
            <div className={'config-item'}>
                <label>Dots</label>
                <Switch value={galleryContent.data.dots} onChange={(checked) => {
                    galleryContent.setDots(checked)
                    setContent(galleryContent.stringData)
                }}/>
            </div>
            <div className={'config-item'}>
                <label>Arrows</label>
                <Switch value={galleryContent.data.arrows} onChange={(checked) => {
                    galleryContent.setArrows(checked)
                    setContent(galleryContent.stringData)
                }}/>
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
                            <EditWrapper wrapperClass={'config-item-container'} admin={true} del={true}
                                         deleteAction={async () => {
                                             galleryContent.removeItem(index)
                                             setContent(galleryContent.stringData)
                                         }}>
                                <div className={`container text-${item.textPosition}`}>
                                    <div className={'config-item'}>
                                        <ImageUpload setFile={setFile}/>
                                        <Input
                                            placeholder={'Image URL'}
                                            value={item.src}
                                            disabled={true}
                                        />
                                    </div>
                                    <div className={'config-item'}>
                                        <label>Description:</label>
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
                    Add Image
                </Button>
            </div>
        </div>
    )
}

export default InputCarousel