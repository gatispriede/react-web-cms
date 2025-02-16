import {Button, Input} from "antd";
import React from "react";
import {IInputContent} from "../../../Interfaces/IInputContent";
import {EItemType} from "../../../enums/EItemType";
import {GalleryContent, IGalleryItem} from "../SectionComponents/Gallery";
import EditWrapper from "../common/EditWrapper";
import ImageUpload from "../ImageUpload";

const InputGallery = ({content, setContent}: IInputContent) => {
    const galleryContent = new GalleryContent(EItemType.Image, content);
    const data = galleryContent.data
    return (
        <div className={'gallery-wrapper'}>
            {
                data.items && data.items.map((item: IGalleryItem, index) => {
                    const setFile = (file: File) => {
                        galleryContent.setItem(index, {
                            ...item,
                            src: 'images/' + file.name
                        })
                        setContent(galleryContent.stringData)
                    }
                    return (
                        <EditWrapper admin={true} del={true} deleteAction={async () => {
                            galleryContent.removeItem(index)
                            setContent(galleryContent.stringData)
                        }}>
                            <div className={`container text-${item.textPosition}`}>
                                <label>
                                    Image URL:
                                </label>
                                <ImageUpload setFile={setFile}/>
                                <Input
                                    placeholder={'Image URL'}
                                    value={item.src}
                                    disabled={true}
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