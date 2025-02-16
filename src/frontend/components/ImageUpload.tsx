import {Button} from "antd";
import {CloudUploadOutlined} from "@ant-design/icons";
import React, {RefObject, useEffect} from "react";
import UpploadManager from "../Classes/UpploadeManager";

const ImageUpload = ({setFile}: {setFile: (file: File) => void}) => {


    const imageRef: RefObject<HTMLImageElement | null> = React.createRef();
    const buttonRef: RefObject<HTMLButtonElement | null> = React.createRef();

    const cb = (inputFile: File) => {
        setFile(inputFile)
    }

    useEffect(() => {
        if(imageRef.current && buttonRef.current){
            new UpploadManager(imageRef.current, buttonRef.current, cb);
        }
    }, [window, imageRef.current, buttonRef.current])

    return (
        <div className={'image-upload'}>
            <img ref={imageRef} alt="" className="uppload-image" width={150} height={50}/>
            <Button ref={buttonRef} className="pure-button pure-button-primary">
                <CloudUploadOutlined /> Upload image
            </Button>
        </div>
    )
}

export default ImageUpload