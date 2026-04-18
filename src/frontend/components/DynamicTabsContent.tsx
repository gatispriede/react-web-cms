import React from "react";
import {Empty} from "antd";
import EditWrapper from "./common/EditWrapper";
import SectionErrorBoundary from "./common/SectionErrorBoundary";
import AddNewSection from "./common/Dialogs/AddNewSection";
import SectionContent from "./SectionContent";
import {ISection} from "../../Interfaces/ISection";
import {IItem} from "../../Interfaces/IItem";
import MongoApi from "../api/MongoApi";
import {IConfigSectionAddRemove} from "../../Interfaces/IConfigSectionAddRemove";
import guid from "../../helpers/guid";
import DraggableWrapper from "./common/DraggableWrapper";
import AuditBadge from "./Admin/AuditBadge";
import {TFunction} from "i18next";
import {InSection} from "../../Interfaces/IMongo";

interface IDynamicTabsContent {
    sections: ISection[],
    page: string,
    admin: boolean,
    refresh: () => Promise<void>,
    t: TFunction<"translation", undefined>,
    tApp: TFunction<string, undefined>
}

interface SContent {
    sections: ISection[],
    page: string,
    state: string,
}

class DynamicTabsContent extends React.Component<IDynamicTabsContent> {
    public refresh: () => Promise<void>;
    state: SContent = {
        sections: [],
        page: '',
        state: ''
    }
    private readonly admin: boolean = false
    private MongoApi = new MongoApi()

    getChangedPos = async (currentPos: number, newPos: number) => {
        if (currentPos === newPos) return;
        // Move semantics — take the dragged item out and re-insert at the
        // target index, shifting the rest. Previous swap-in-place left two
        // items swapped instead of one moved.
        const sections = [...this.state.sections];
        const [moved] = sections.splice(currentPos, 1);
        if (!moved) return;
        sections.splice(newPos, 0, moved);
        this.setState({sections});
        const ids = sections.map(s => s.id).filter((id): id is string => typeof id === 'string');
        if (ids.length === 0) return;
        try {
            await this.MongoApi.updateNavigation(this.state.page, ids);
            await this.refresh();
        } catch (err) {
            console.error('reorder failed', err);
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
            state: guid()
        }
    }

    render() {
        const hasSections = this.state.sections && this.state.sections.length > 0;
        return (
            <div className={'dynamic-content'}>
                {!hasSections && (
                    <Empty
                        description={this.admin
                            ? this.props.t('No sections yet — add your first one below.')
                            : this.props.t('This page is empty.')}
                        style={{padding: '48px 0'}}
                    />
                )}
                <DraggableWrapper admin={this.admin} id={`${this.state.sections.length}-${this.state.state}`}
                                  onPosChange={this.getChangedPos}>
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
                                    <div key={`${index}-${section.type}`} className={`${index}-${section.type}`}>
                                        {this.admin && (section as any).editedAt && (
                                            <div style={{padding: '4px 8px 0'}}>
                                                <AuditBadge
                                                    editedBy={(section as any).editedBy}
                                                    editedAt={(section as any).editedAt}
                                                    compact
                                                />
                                            </div>
                                        )}
                                        <SectionErrorBoundary admin={this.admin} sectionId={section.id}>
                                            <EditWrapper t={this.props.t} admin={this.admin} deleteAction={async () => {
                                                if (section.id) {
                                                    await this.MongoApi.deleteSection(section.id)
                                                    const sections = this.state.sections.filter((filterSection: ISection) => filterSection.id !== section.id)
                                                    this.setState({sections})
                                                    await this.refresh()
                                                }
                                            }}>
                                                <SectionContent
                                                    admin={this.admin}
                                                    t={this.props.t}
                                                    tApp={this.props.tApp}
                                                    section={section}
                                                    refresh={async () => {
                                                        await this.refresh()
                                                    }}
                                                    addRemoveSectionItem={
                                                        async (sectionId: string, config: IConfigSectionAddRemove) => {
                                                            await this.MongoApi.addRemoveSectionItem(sectionId, config, this.state.sections)
                                                            this.setState({state: guid()})
                                                        }
                                                    }/>
                                            </EditWrapper>
                                        </SectionErrorBoundary>
                                    </div>
                                )
                            }
                        )
                    }
                </DraggableWrapper>
                {this.admin && <div className={'new-section-wrapper'}>
                    <AddNewSection
                        t={this.props.t}
                        page={this.state.page}
                        addSectionToPage={async (item: { section: InSection}) => {
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