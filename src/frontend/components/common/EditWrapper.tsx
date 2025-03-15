import {DeleteOutlined, EditOutlined} from "@ant-design/icons";
import {Button, Popconfirm} from 'antd';
import {JSX} from "react";

interface PropsEditWrapper {
    children: React.ReactNode,
    deleteAction?: () => Promise<void>
    editAction?: () => void,
    editContent?: JSX.Element,
    edit?: boolean
    del?: boolean
    admin: boolean
    wrapperClass?: string
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
        del = true
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
                                title="Delete"
                                description="Are you sure to delete?"
                                onConfirm={async () => {
                                    await deleteAction()
                                }}
                                okText="Delete"
                                cancelText="Cancel"
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