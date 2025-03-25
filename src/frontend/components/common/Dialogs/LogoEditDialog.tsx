import {Modal} from "antd";
import React from "react";
import ImageUpload from "../../ImageUpload";
import {TFunction} from "i18next";

const LogoEditDialog = ({open, setOpen, t}: {
    open: boolean,
    setOpen: (file: File | false) => void,
    t: TFunction<"translation", undefined>
}) => {
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
                {t("Upload Logo Image, please select image")}
                <ImageUpload t={t} setFile={setFile}/>
            </div>
        </Modal>
    )
}

export default LogoEditDialog