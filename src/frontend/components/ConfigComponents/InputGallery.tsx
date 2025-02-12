import {Button, Input} from "antd";
import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {EItemType} from "../../../enums/EItemType";
import {GalleryContent, IGalleryItem} from "../SectionComponents/Gallery";
import EditWrapper from "../common/EditWrapper";

const InputGallery = ({content, setContent}: IInputContent) => {
    const galleryContent = new GalleryContent(EItemType.Image, content);
    const data = galleryContent.data
    return (
        <div className={'gallery-wrapper'}>
            {
                data.items && data.items.map((item: IGalleryItem, index) => {
                    return (
                        <EditWrapper admin={true} del={true} deleteAction={async () => {
                            galleryContent.removeItem(index)
                            setContent(galleryContent.stringData)
                        }}>
                            <div className={`container text-${item.textPosition}`}>
                                <label>
                                    Image URL:
                                </label>
                                <Input
                                    placeholder={'Image URL'}
                                    value={item.src}
                                    onChange={({target: {value}}) => {
                                        galleryContent.setItem(index, {
                                            ...item,
                                            src: value
                                        })
                                        setContent(galleryContent.stringData)
                                    }}
                                />
                                <label>
                                    Description:
                                </label>
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
                                <hr/>

                            </div>
                        </EditWrapper>
                    )
                })
            }
            <div className={'add-image-container'}>
                <Button onClick={() => {
                    galleryContent.addItem()
                    setContent(galleryContent.stringData)
                }}>
                    Add
                </Button>
            </div>
        </div>
    )
}

export default InputGallery