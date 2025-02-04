import {DeleteOutlined} from "@ant-design/icons";
import {Button, Popconfirm} from 'antd';

const EditWrapper = ({children, deleteAction, edit = false}) => {
    return (
        <>
            {edit && <div className={'edit-button-container'}>
                <Button>
                    edit
                </Button>
            </div>}
            {
                children && <div>{children}</div>
            }
            <div className={'edit-button-container'}>
                <Popconfirm
                    title="Delete"
                    description="Are you sure to delete?"
                    onConfirm={() => {
                        deleteAction()
                    }}
                    okText="Delete"
                    cancelText="Cancel"
                >
                    <Button danger>
                        <DeleteOutlined/>
                    </Button>
                </Popconfirm>
            </div>
        </>
    )
}
export default EditWrapper