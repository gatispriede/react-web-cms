import EditWrapper from "./common/EditWrapper";
import React from "react";
import AddNewSectionItem from "./common/AddNewSectionItem";
enum EType {
    TEXT = "TEXT",
    IMAGE = "IMAGE",
    EMPTY = "EMPTY",
}

const SectionContent = ({section, addRemoveSectionItem}) => {
    console.log('load')
    return (
        <div>
            {
                section.content.map((item, id: number) => {
                    switch (item.type) {
                        case EType.TEXT:
                            return (
                                <EditWrapper key={id}
                                             deleteAction={() => {
                                                 addRemoveSectionItem(section.id, {
                                                     index: id,
                                                     type: EType.EMPTY,
                                                     content: "",
                                                 })
                                             }}>
                                    <span >{item.content}</span>
                                </EditWrapper>
                            )
                        case EType.IMAGE:
                            return (
                                <EditWrapper key={id}
                                             deleteAction={() => {
                                                 addRemoveSectionItem(section.id, {
                                                     index: id,
                                                     type: EType.EMPTY,
                                                     content: "",
                                                 })
                                             }}>
                                    <img src={item.content}></img>
                                </EditWrapper>
                            )
                        case EType.EMPTY:
                            return (
                                <div>
                                    Empty section item
                                    <AddNewSectionItem index={id} section={section} addSectionItem={addRemoveSectionItem}/>
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