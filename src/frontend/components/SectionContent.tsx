import EditWrapper from "./common/EditWrapper";
import React from "react";
import {ISection} from "../../Interfaces/ISection";
import {EItemType} from "../../enums/EItemType";
import ContentType from "./common/ContentType";
import AddNewSectionItem from "./common/Dialogs/AddNewSectionItem";
import {IConfigSectionAddRemove} from "../../Interfaces/IConfigSectionAddRemove";
import ActionDialog from "./common/Dialogs/ActionDialog";
import {EStyle} from "../../enums/EStyle";
import {IItem} from "../../Interfaces/IItem";
import {TFunction} from "i18next";

interface IPropsSectionContent {
    section: ISection,
    addRemoveSectionItem: (sectionId: string, config: IConfigSectionAddRemove) => Promise<void>,
    refresh: () => Promise<void>,
    admin: boolean,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}

interface IStateSectionContent {
    section: ISection;
    actionDialogOpen: boolean;
    refresh: () => Promise<void>;
}

class SectionContent extends React.Component<IPropsSectionContent> {
    state: IStateSectionContent = {
        actionDialogOpen: false,
        section: {
            content: [],
            type: 0,
            id: ''
        },

        refresh: async () => {
        }
    }
    admin: boolean = false;
    addRemoveSectionItem: (sectionId: string, config: IConfigSectionAddRemove) => Promise<void>

    constructor(props: IPropsSectionContent) {
        super(props);
        this.state.section = props.section
        this.addRemoveSectionItem = props.addRemoveSectionItem;
        this.admin = props.admin;
    }

    render() {
        return (
            <div className={'section'}>
                {
                    this.state.section.content.map((item: IItem, id: number) => {
                        const layoutClass = [
                            'width-100',
                            'width-100',
                            'width-50',
                            'width-33',
                            'width-25',
                        ]
                        const style = {
                            height: '100%'
                        }
                        const sectionId = this.state.section.id ? this.state.section.id : ''
                        return (
                            <div key={id}
                                 className={`section-item-container ${item.type} ${layoutClass[this.state.section.type]}`}
                                 style={style}>
                                <EditWrapper
                                    t={this.props.t}
                                    admin={this.admin}
                                    key={id}
                                    del={item.type !== EItemType.Empty}
                                    edit={item.type !== EItemType.Empty}
                                    editContent={
                                        item.type !== EItemType.Empty ? <AddNewSectionItem
                                                t={this.props.t}
                                                tApp={this.props.tApp}
                                                index={id}
                                                addSectionItem={this.props.addRemoveSectionItem}
                                                section={this.state.section}
                                                loadItem={true}
                                            /> :
                                            <></>
                                    }
                                    deleteAction={async () => {
                                        await this.addRemoveSectionItem(sectionId, {
                                            index: id,
                                            style: EStyle.Default,
                                            type: EItemType.Empty,
                                            content: "",
                                        })
                                    }}
                                >
                                    <div
                                        className={`content-wrapper ${item.action === "onClick" ? 'action-enabled' : ''}`}
                                        onClick={(event) => {
                                            if (item.action === 'onClick' && !this.state.actionDialogOpen) {
                                                this.setState({actionDialogOpen: true})
                                            }
                                        }}>
                                        <ContentType
                                            t={this.props.t}
                                            tApp={this.props.tApp}
                                            admin={this.admin}
                                            item={item}
                                            addButton={
                                                <AddNewSectionItem
                                                    t={this.props.t}
                                                    tApp={this.props.tApp}
                                                    index={id}
                                                    addSectionItem={this.addRemoveSectionItem}
                                                    section={this.state.section}
                                                    loadItem={false}
                                                />
                                            }
                                        />
                                        {item.action && item.action !== 'none' &&
                                            <ActionDialog t={this.props.t} tApp={this.props.tApp} item={item}
                                                          open={this.state.actionDialogOpen} close={() => {
                                                this.setState({actionDialogOpen: false})
                                            }}/>
                                        }
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