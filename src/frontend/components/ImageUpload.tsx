import {Alert, Button, Input, Modal, Tabs} from "antd";
import {CloudUploadOutlined} from "@ant-design/icons";
import React, {RefObject, useEffect, useState} from "react";
import UpploadManager from "../Classes/UpploadeManager";
import EditableTags from "./common/EditableTags";
import {IImage} from "../gqty";
import MongoApi from "../api/MongoApi";
import {ImImages} from "react-icons/im";

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
        <div className={'image-upload'}>
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
                        <img ref={imageRef} alt="" className="uppload-image" width={150} height={50}/>
                    </div>

                </div>
                <hr />
                <div className={'image-select-container'}>
                    <Input value={searchTag} onChange={(e) => {
                        setSearchTag(e.target.value);
                    }} />
                    <Button onClick={loadImages}>Search Images</Button>
                    {
                        images.map((image: IImage, index) => {
                            return (
                                <div key={index} className={'image-item'}>
                                    <img src={image.location} alt="" width={150} height={50}/>
                                    <Button onClick={() => {
                                        console.log(image)
                                        setFile(image as unknown as File)
                                        setDialogOpen(false)
                                    }}>
                                        Select image
                                    </Button>
                                </div>
                            )
                        })
                    }
                </div>

            </Modal>
        </div>
    )
}

export default ImageUpload