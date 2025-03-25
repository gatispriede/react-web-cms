import {Alert, Button, Input, Modal} from "antd";
import {CloudUploadOutlined} from "@ant-design/icons";
import React, {RefObject, useEffect, useState} from "react";
import UpploadManager from "../Classes/UpploadeManager";
import EditableTags from "./common/EditableTags";
import MongoApi from "../api/MongoApi";
import EditWrapper from "./common/EditWrapper";
import {TFunction} from "i18next";
import IImage from "../../Interfaces/IImage";

const ImageUpload = ({setFile, t}: { setFile: (file: File) => void, t: TFunction<"translation", undefined> }) => {

    let upploadManager: UpploadManager;
    const mongoApi = new MongoApi()

    const imageRef: RefObject<HTMLImageElement | null> = React.createRef();
    const buttonRef: RefObject<HTMLButtonElement | null> = React.createRef();

    const [error, setErrorState] = useState('')
    const [dialogOpen, setDialogOpen] = useState(false)
    const [images, setImages] = useState<IImage[]>([])
    const [searchTag, setSearchTag] = useState('All')

    const cb = (inputFile: File) => {
        setFile(inputFile)
        setDialogOpen(false)
    }
    const setError = (err: string) => {
        console.error(err)
        setErrorState(err)
    }

    const setTags = (tags: string[]) => {
        if (upploadManager) {
            upploadManager.setTags(tags);
        }
    }
    const loadImages = async () => {
        const images: IImage[] = await mongoApi.getImages(searchTag.length > 2 ? searchTag : 'All')
        setImages(images)
    }

    useEffect(() => {
        if (imageRef.current && buttonRef.current) {
            upploadManager = new UpploadManager(imageRef.current, buttonRef.current, cb, setError);
            void loadImages()
        }
    }, [window, imageRef.current, buttonRef.current, dialogOpen])

    return (
        <div>
            <Button type={'primary'} onClick={() => {
                setDialogOpen(true)
            }}>
                {t("Select Image")}
            </Button>
            <Modal
                width={'90%'}
                title={t('Image Selection')}
                open={dialogOpen}
                onCancel={async () => {
                    setDialogOpen(false)
                }}
                onOk={async () => {
                    setDialogOpen(false)
                }}
            >
                <div className={'image-upload'}>
                    <div className={'upload-image-container'}>
                        {
                            error !== '' &&
                            <Alert
                                message={t("Error")}
                                description={error}
                                type="error"
                                showIcon
                            />
                        }
                        <div className={'tag-container'}>
                            <label>{t("Add / Remove Tags")}</label>
                            <EditableTags setTagsProp={(tags: string[]) => {
                                setTags(tags)
                            }}/>
                        </div>
                        <div className={'image-container'}>
                            <Button ref={buttonRef} className="pure-button pure-button-primary">
                                <CloudUploadOutlined/> {t("Upload New Image")}
                            </Button>
                        </div>
                        <div className={'image-preview'}>
                            {t("Image Preview")}
                            <img ref={imageRef} alt="" className="uppload-image" />
                        </div>
                    </div>
                    <hr/>
                    <div className={'image-select-container'}>
                        <div className={'image-search-container'}>
                            <Input value={searchTag} onChange={(e) => {
                                setSearchTag(e.target.value);
                            }}/>
                            <Button onClick={loadImages}>{t("Search Images")}</Button>
                        </div>
                        <hr/>
                        <div className={'image-result-container'}>
                            {
                                images.map((image: IImage, index) => {
                                    return (
                                        <div className={'image-item'}>
                                            <EditWrapper t={t} key={index} admin={true} del={true} deleteAction={async () => {
                                                await mongoApi.deleteImage(image.id);
                                                await loadImages()
                                            }}>
                                                <div key={index}>
                                                    <img src={`/${image.location}`} alt=""/>
                                                    <Button onClick={() => {
                                                        console.warn(image)
                                                        setFile(image as unknown as File)
                                                        setDialogOpen(false)
                                                    }}>
                                                        {t("Select image")}
                                                    </Button>
                                                </div>
                                            </EditWrapper>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default ImageUpload