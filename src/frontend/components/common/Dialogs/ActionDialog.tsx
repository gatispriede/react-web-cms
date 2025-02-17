import ContentType from "../ContentType";
import {Modal} from "antd";
import React from "react";
import {IItem} from "../../../../Interfaces/IItem";
import {EItemType} from "../../../../enums/EItemType";

const ActionDialog = ({item, open, close}: {item: IItem, open:boolean, close: () => void}) => {
    const newItem = {
        type: item.actionType ? item.actionType : EItemType.Text,
        content: item.actionContent ? item.actionContent : '{}'
    }
    return (
        <Modal
            title={''}
            width={'90%'}
            open={open}
            onCancel={async () => {
                close()
            }}
            onOk={async () => {
                close()
            }}
            footer={[]}
        >
            <div>
                <ContentType admin={false} item={newItem} addButton={""} />
            </div>
        </Modal>
    )
}

export default ActionDialog