import React from "react";
import EditWrapper from "./common/EditWrapper";
import AddNewSection from "./common/AddNewSection";
import {resolve} from "../gqty";
import SectionContent from "./SectionContent";

enum ETypeWidth {
    '100%' = 1,
    '50%',
    '33%',
    '25%',
}

interface ISection {
    section: any;
    id: string,
    type: number,
    page: string,
    content: any[]
}

interface IContentProps {
    sections: ISection[],
    page: string,
    refresh: () => void
}

interface SContent {
    sections: ISection[],
    page: string,
}

class DynamicTabsContent extends React.Component {
    private readonly refresh: () => void;
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
                return mutation.mongo.removeSectionItem(update)
            },
        );
        this.refresh()
    }
    addRemoveSectionItem = async (sectionId: string, config: any) => {
        const section = this.state.sections.find(section => section.id === sectionId)
        if (!section) {
            console.log('no section to add item to')
            return;
        }
        (section as ISection).content[config.index] = {
            type: config.type,
            content: config.content
        }
        const input = {
            section: section
        }
        await resolve(
            ({mutation}) => {
                return mutation.mongo.addUpdateSectionItem(input)
            },
        )
        this.refresh()
    }

    render() {
        console.log('refresh')
        return (
            <div>
                <div>
                    {
                        this.state.sections.map((section: ISection) => {
                                const emptySections = section.type - section.content?.length
                                if (emptySections > 0) {
                                    const emptySection = {
                                        type: "EMPTY"
                                    }
                                    for (let i = 0; i < emptySections; i++) {
                                        section.content?.push(emptySection)
                                    }
                                }
                                return (
                                    <EditWrapper deleteAction={() => {
                                        this.deleteSection(section.id)
                                    }}>
                                        <SectionContent section={section} addRemoveSectionItem={this.addRemoveSectionItem}/>
                                    </EditWrapper>
                                )
                            }
                        )
                    }
                </div>
                <div>
                    <AddNewSection refresh={() => {
                        this.refresh()
                    }} page={this.state.page}/>
                </div>
            </div>
        )
    }
}

export default DynamicTabsContent