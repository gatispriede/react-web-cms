import React from "react";
import EditWrapper from "./common/EditWrapper";
import AddNewSection from "./common/Dialogs/AddNewSection";
import SectionContent from "./SectionContent";
import {ISection} from "../../Interfaces/ISection";
import {IItem} from "../../Interfaces/IItem";
import MongoApi from "../api/MongoApi";
import {IConfigSectionAddRemove} from "../../Interfaces/IConfigSectionAddRemove";

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
                <>
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
                                    <EditWrapper admin={this.admin} key={index} deleteAction={async () => {
                                        await this.MongoApi.deleteSection(section.id ? section.id : '')
                                        this.state.sections.splice(index, 1)
                                        this.setState({sections: this.state.sections})
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
                                )
                            }
                        )
                    }
                </>
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