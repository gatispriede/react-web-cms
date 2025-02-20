'use client'
import React from "react";
import EditWrapper from "./common/EditWrapper";
import AddNewSection from "./common/Dialogs/AddNewSection";
import SectionContent from "./SectionContent";
import {ISection} from "../../Interfaces/ISection";
import {IItem} from "../../Interfaces/IItem";
import MongoApi from "../api/MongoApi";
import {IConfigSectionAddRemove} from "../../Interfaces/IConfigSectionAddRemove";
import {Draggable} from "react-drag-reorder";

interface IDynamicTabsContent {
    sections: ISection[],
    page: string,
    admin: boolean,
    refresh: () => Promise<void>
}

interface SContent {
    sections: ISection[],
    page: string,
}

class DynamicTabsContent extends React.Component<IDynamicTabsContent> {
    props: IDynamicTabsContent = {
        sections: [],
        page: '',
        admin: false,
        refresh: async () => {
        }
    }
    public refresh: () => Promise<void>;
    state: SContent = {
        sections: [],
        page: '',
    }
    private readonly admin: boolean = false
    private MongoApi = new MongoApi()

    getChangedPos = (currentPos: any, newPos: any) => {
        const sections = this.state.sections;
        sections[currentPos] = sections.splice(newPos, 1, sections[currentPos])[0];
        this.setState({sections});
        const sectionsStringArray: string[] = []
        sections.map((section: ISection) => {
                if(section.id) sectionsStringArray.push(section.id as string)
            }
        )
        if (sectionsStringArray.length > 0) {
            void this.MongoApi.updateNavigation(this.state.page, sectionsStringArray)
        }
    };

    constructor(props: IDynamicTabsContent) {
        super(props)
        const {sections, page, refresh, admin} = props
        this.refresh = refresh
        this.admin = admin
        this.state = {
            sections: sections,
            page: page,
        }
    }

    render() {
        return (
            <div className={'dynamic-content'}>
                <Draggable key={this.state.sections.length} onPosChange={this.getChangedPos}>

                    {
                        this.state.sections && this.state.sections.map((section: ISection, index) => {
                                const emptySections = section.type - section.content?.length
                                if (emptySections > 0) {
                                    const emptySection = {
                                        type: "EMPTY",
                                        content: '{}'
                                    }
                                    for (let i = 0; i < emptySections; i++) {
                                        section.content?.push(emptySection as IItem)
                                    }
                                }
                                return (
                                    <div key={`${index}-${section.type}`}>
                                        <EditWrapper admin={this.admin} deleteAction={async () => {
                                            if (section.id) {
                                                await this.MongoApi.deleteSection(section.id)
                                                const sections = this.state.sections.filter((filterSection: ISection) => filterSection.id !== section.id)
                                                this.setState({sections})
                                                this.forceUpdate()
                                            }
                                        }}>
                                            <SectionContent
                                                admin={this.admin}
                                                section={section}
                                                refresh={async () => {
                                                    await this.refresh()
                                                }}
                                                addRemoveSectionItem={
                                                    async (sectionId: string, config: IConfigSectionAddRemove) => {
                                                        await this.MongoApi.addRemoveSectionItem(sectionId, config, this.state.sections)
                                                        await this.props.refresh()
                                                    }
                                                }/>

                                        </EditWrapper>
                                    </div>
                                )
                            }
                        )
                    }
                </Draggable>
                {this.admin && <div className={'new-section-wrapper'}>
                    <AddNewSection
                        page={this.state.page}
                        addSectionToPage={async (item: any) => {
                            const result = await this.MongoApi.addSectionToPage(item, this.state.sections)
                            this.setState({sections: result})
                        }}
                    />
                </div>
                }
            </div>
        )
    }
}

export default DynamicTabsContent