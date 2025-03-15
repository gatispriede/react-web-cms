import {Button, Input} from "antd";
import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {EItemType} from "../../../enums/EItemType";
import {GalleryContent, IGalleryItem} from "../SectionComponents/Gallery";
import EditWrapper from "../common/EditWrapper";
import ImageUpload from "../ImageUpload";
import {PUBLIC_IMAGE_PATH} from "../../../constants/imgPath";

const InputGallery = ({content, setContent}: IInputContent) => {
    const galleryContent = new GalleryContent(EItemType.Image, content);
    const data = galleryContent.data
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
                        return (
                            <EditWrapper admin={true} del={true} deleteAction={async () => {
                                galleryContent.removeItem(index)
                                setContent(galleryContent.stringData)
                            }}>
                                <div className={`container text-${item.textPosition}`}>
                                    <div className={'config-item'}>
                                        <label>Image URL</label>
                                        <ImageUpload setFile={setFile}/>
                                        <Input
                                            placeholder={'Image URL'}
                                            value={item.src}
                                            disabled={true}
                                        />
                                    </div>
                                    <div className={'config-item'}>
                                        <label>Description</label>
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
                                    <div className={'config-item'}>
                                        <label>Image width</label>
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
                                    <div className={'config-item'}>
                                        <label>Image Height</label>
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

export default InputGallery