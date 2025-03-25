import {DeleteOutlined, EditOutlined} from "@ant-design/icons";
import {Button, Popconfirm} from 'antd';
import React, {JSX} from "react";
import {TFunction} from "i18next";

interface PropsEditWrapper {
    children: React.ReactNode,
    deleteAction?: () => Promise<void>,
    editAction?: () => void,
    editContent?: JSX.Element,
    edit?: boolean,
    del?: boolean,
    admin: boolean,
    wrapperClass?: string,
    t: TFunction<"translation", undefined>
}

const EditWrapper = (
    {
        admin,
        wrapperClass,
        children,
        editAction,
        editContent,
        deleteAction,
        edit = false,
        del = true,
        t
    }: PropsEditWrapper) => {
    return (
        <div className={wrapperClass}>
            {
                admin ?
                    <div className={'edit-wrapper'}>
                        {(edit && editContent) && <div className={'edit-button-container edit-container'}>
                            <div className={'edit-button'}>
                                {editContent}
                            </div>
                        </div>}
                        {
                            children && <div>{children}</div>
                        }
                        {
                            (del && deleteAction) && <div className={'edit-button-container delete-container'}>
                                <Popconfirm
                                    title={t("Delete")}
                                    description={t("Are you sure to delete?")}
                                    onConfirm={async () => {
                                        await deleteAction()
                                    }}
                                    okText={t("Delete")}
                                    cancelText={t("Cancel")}
                                >
                                    <Button danger>
                                        <DeleteOutlined/>
                                    </Button>
                                </Popconfirm>
                            </div>
                        }

                    </div>
                    :
                    <div>{children}</div>
            }
        </div>
    )
}
export default EditWrapper