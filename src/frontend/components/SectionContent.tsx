import EditWrapper from "./common/EditWrapper";
import React from "react";
import {Button} from "antd";
import AddNewSectionItem from "./common/AddNewSectionItem";
enum EType {
    TEXT = "TEXT",
    IMAGE = "IMAGE",
    EMPTY = "EMPTY",
}

const SectionContent = ({content}) => {
    return (
        <div>
            {
                content.map((item, id) => {
                    switch (item.type) {
                        case EType.TEXT:
                            return (
                                <EditWrapper key={id} children={<input value={item.content as string}/>}
                                             deleteAction={undefined}>

                                </EditWrapper>
                            )
                        case EType.IMAGE:
                            return (
                                <EditWrapper key={id} children={<input value={item.content as string}/>}
                                             deleteAction={undefined}>

                                </EditWrapper>
                            )
                        case EType.EMPTY:
                            return (
                                <div>
                                    Empty section
                                    <AddNewSectionItem />
                                </div>
                            )
                        default:
                            return '';
                    }
                })
            }
        </div>
    )
}

export default SectionContent