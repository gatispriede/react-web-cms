import {Modal} from "antd";
import React from "react";
import ImageUpload from "../../ImageUpload";

const LogoEditDialog = ({open, setOpen}: {open: boolean, setOpen: (file: File | false) => void}) => {
    const [file, setFile] = React.useState<File | null>(null)
    return (
        <Modal
            title={''}
            width={'90%'}
            open={open}
            onCancel={ () => {
                setOpen(false);
            }}
            onOk={ () => {
                setOpen(file as File)
            }}
        >
            <div>
                <ImageUpload setFile={setFile}/>
            </div>
        </Modal>
    )
}

export default LogoEditDialog