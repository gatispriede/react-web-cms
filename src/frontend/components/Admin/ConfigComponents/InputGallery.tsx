import {Button, Input} from "antd";
import React from "react";
import {IInputContent} from "../../../../Interfaces/IInputContent";
import {EItemType} from "../../../../enums/EItemType";
import {GalleryContent, IGalleryItem} from "../../SectionComponents/Gallery";
import EditWrapper from "../../common/EditWrapper";
import ImageUpload from "../../ImageUpload";
import {PUBLIC_IMAGE_PATH} from "../../../../constants/imgPath";

const InputGallery = ({content, setContent, t}: IInputContent) => {
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
                            <EditWrapper t={t} key={index} wrapperClass={'config-item-container'} admin={true} del={true} deleteAction={async () => {
                                galleryContent.removeItem(index)
                                setContent(galleryContent.stringData)
                            }}>
                                <div key={index} className={`admin container text-${item.textPosition}`}>
                                    <div className={'config-item'}>
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
            <div className={'add-image-container'}>
                <Button type="primary" onClick={() => {
                    galleryContent.addItem()
                    setContent(galleryContent.stringData)
                }}>
                    {t("Add New Image")}
                </Button>
            </div>
        </div>
    )
}

export default InputGallery