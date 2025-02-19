import {Alert, Button, Input, Modal, Tabs} from "antd";
import {CloudUploadOutlined} from "@ant-design/icons";
import React, {RefObject, useEffect, useState} from "react";
import UpploadManager from "../Classes/UpploadeManager";
import EditableTags from "./common/EditableTags";
import {IImage} from "../gqty";
import MongoApi from "../api/MongoApi";
import {ImImages} from "react-icons/im";
import EditWrapper from "./common/EditWrapper";

const ImageUpload = ({setFile}: { setFile: (file: File) => void }) => {

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
        console.log(err)
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
                Select Image
            </Button>
            <Modal
                width={'90%'}
                title={'Image Selection'}
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
                                message="Error"
                                description={error}
                                type="error"
                                showIcon
                            />
                        }
                        <div className={'tag-container'}>
                            <label>Add / Remove Tags</label>
                            <EditableTags setTagsProp={(tags: string[]) => {
                                setTags(tags)
                            }}/>
                        </div>
                        <div className={'image-container'}>
                            <Button ref={buttonRef} className="pure-button pure-button-primary">
                                <CloudUploadOutlined/> Upload New Image
                            </Button>
                        </div>
                        <div className={'image-preview'}>
                            Image Preview
                            <img ref={imageRef} alt="" className="uppload-image" />
                        </div>
                    </div>
                    <hr/>
                    <div className={'image-select-container'}>
                        <div className={'image-search-container'}>
                            <Input value={searchTag} onChange={(e) => {
                                setSearchTag(e.target.value);
                            }}/>
                            <Button onClick={loadImages}>Search Images</Button>
                        </div>
                        <hr/>
                        <div className={'image-result-container'}>
                            {
                                images.map((image: IImage, index) => {
                                    return (
                                        <div className={'image-item'}>

                                            <EditWrapper key={index} admin={true} del={true} deleteAction={async () => {
                                                await mongoApi.deleteImage(image.id);
                                                await loadImages()
                                            }}>
                                                <div key={index}>
                                                    <img src={image.location} alt=""/>
                                                    <Button onClick={() => {
                                                        console.log(image)
                                                        setFile(image as unknown as File)
                                                        setDialogOpen(false)
                                                    }}>
                                                        Select image
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