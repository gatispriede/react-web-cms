import EditWrapper from "./common/EditWrapper";
import React from "react";
import {ISection} from "../../Interfaces/ISection";
import {EItemType} from "../../enums/EItemType";
import ContentType from "./common/ContentType";
import AddNewSectionItem from "./common/AddNewSectionItem";

interface PropsSectionContent {
    section: ISection;
    addRemoveSectionItem: (sectionId: string | undefined, config: any) => Promise<void>;
    refresh: () => void;
}

class SectionContent extends React.Component {
    props: PropsSectionContent = {
        section: {
            content: [],
            type: 0,
            id: ''
        },
        addRemoveSectionItem: async () => {
        },
        refresh: async () => {
        }
    }
    state: PropsSectionContent = {
        section: {
            content: [],
            type: 0,
            id: ''
        },
        addRemoveSectionItem: async () => {
        },
        refresh: async () => {
        }
    }

    constructor({section, addRemoveSectionItem}: PropsSectionContent) {
        super({section, addRemoveSectionItem});
        this.state = {
            section: section,
            addRemoveSectionItem,
            refresh: async () => {
            }
        }
    }

    render() {
        return (
            <div className={'section'}>
                {
                    this.state.section.content.map((item, id: number) => {
                        const sectionWidth = [
                            '100%',
                            '100%',
                            '50%',
                            '33%',
                            '25%',
                        ]
                        const style = {
                            width: sectionWidth[this.state.section.type],
                            height: '100%'
                        }
                        return (
                            <div className={'section-item-container'} style={style}>
                                <EditWrapper
                                    key={id}
                                    del={item.type !== EItemType.Empty}
                                    edit={item.type !== EItemType.Empty}
                                    editContent={
                                        item.type !== EItemType.Empty ? <AddNewSectionItem
                                            index={id}
                                            addSectionItem={this.props.addRemoveSectionItem}
                                            section={this.state.section}
                                            loadItem={true}
                                        /> :
                                            <></>
                                    }
                                    deleteAction={ async () => {
                                        await this.state.addRemoveSectionItem(this.state.section.id, {
                                            index: id,
                                            type: EItemType.Empty,
                                            content: "",
                                        })
                                    }}
                                >
                                    <div className={'content-wrapper'}>
                                        <ContentType
                                            type={item.type}
                                            content={item.content}
                                            addButton={
                                                <AddNewSectionItem
                                                    index={id}
                                                    addSectionItem={this.props.addRemoveSectionItem}
                                                    section={this.state.section}
                                                    loadItem={false}
                                                />
                                            }
                                        />
                                    </div>
                                </EditWrapper>
                            </div>
                        )
                    })
                }
            </div>
        )
    }
}

export default SectionContent