import ContentType from "../ContentType";
import {Modal} from "antd";
import React from "react";
import {IItem} from "../../../../Interfaces/IItem";
import {EItemType} from "../../../../enums/EItemType";
import {TFunction} from "i18next";

const ActionDialog = ({item, open, close, t, tApp}: {
    item: IItem,
    open: boolean,
    close: () => void,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}) => {
    const newItem = {
        type: item.actionType ? item.actionType : EItemType.Text,
        content: item.actionContent ? item.actionContent : '{}',
        style: item.actionStyle ? item.actionStyle : 'default'
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
                <ContentType t={t} tApp={tApp} admin={false} item={newItem} addButton={""} />
            </div>
        </Modal>
    )
}

export default ActionDialog