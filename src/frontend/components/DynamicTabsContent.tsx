import React from "react";
import EditWrapper from "./common/EditWrapper";
import AddNewSection from "./common/AddNewSection";
import {resolve} from "../gqty";
import SectionContent from "./SectionContent";
import {InSection, MutationMongo} from "../../Interfaces/IMongo";
import {ISection} from "../../Interfaces/ISection";
import {IItem} from "../../Interfaces/IItem";
import {Layout} from "antd";
import AddNewSectionItem from "./common/AddNewSectionItem";


interface IContentProps {
    sections: ISection[],
    page: string,
    refresh: () => Promise<void>
}

interface SContent {
    sections: ISection[],
    page: string,
}

class DynamicTabsContent extends React.Component {
    props: IContentProps = {
        sections: [],
        page: '',
        refresh: async () => {
        }
    }
    public refresh: () => Promise<void>;
    state: SContent = {
        sections: [],
        page: '',
    }

    constructor(props: IContentProps) {
        super(props)
        const {sections, page, refresh} = props
        this.refresh = refresh
        this.state = {
            sections: sections,
            page: page,
        }
    }

    deleteSection = async (sectionId: string) => {
        if (!sectionId) {
            return;
        }
        await resolve(
            ({mutation}) => {
                const update = {
                    id: sectionId
                }
                return (mutation as MutationMongo).mongo.removeSectionItem(update)
            },
        )
        this.forceUpdate()
    }
    addRemoveSectionItem = async (sectionId: string | undefined, config: any) => {
        const section = this.state.sections.find(section => section.id === sectionId)
        console.log(section, config.index, config.content)
        if (!section) {
            console.log('no section to add item to')
            return;
        }
        section.content[config.index] = {
            type: config.type,
            content: config.content
        }
        const input = {
            section: (section as InSection)
        }
        const result = await resolve(
            ({mutation}) => {
                return (mutation as MutationMongo).mongo.addUpdateSectionItem(input)
            },
        )
        await this.props.refresh()
    }

    async addSectionToPage(item: any) {

        const result = await resolve(
            ({mutation}) => {

                console.log('adding section')

                return (mutation as MutationMongo).mongo.addUpdateSectionItem(item)
            },
        );

        try {
            const resultObject = JSON.parse(result)
            if (resultObject.createSection) {
                if (resultObject.createSection.id) {
                    item.section.id = resultObject.createSection.id
                    const sections = this.state.sections
                    sections.push(item.section)
                    this.setState({sections})
                }
            }
        } catch (err) {
            console.log(err)
        }
    }

    render() {
        return (
            <div className={'dynamic-content'}>
                <div>
                    {
                        this.state.sections.map((section: ISection, index) => {
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
                                    <EditWrapper key={index} deleteAction={async () => {
                                        this.state.sections.splice(index, 1)
                                        await this.deleteSection(section.id ? section.id : '')
                                    }}>
                                        <SectionContent
                                            section={section}
                                            refresh={async () => {
                                                await this.refresh()
                                            }}
                                            addRemoveSectionItem={this.addRemoveSectionItem}/>

                                    </EditWrapper>
                                )
                            }
                        )
                    }
                </div>
                <div className={'new-section-wrapper'}>
                    <AddNewSection
                        page={this.state.page}
                        addSectionToPage={async (item: any) => {
                            await this.addSectionToPage(item)
                        }}
                    />
                </div>
            </div>
        )
    }
}

export default DynamicTabsContent