import React from "react";
import EditWrapper from "./common/EditWrapper";
import AddNewSection from "./common/AddNewSection";
import {ISection, resolve} from "../gqty";
import SectionContent from "./SectionContent";

enum ETypeWidth {
    '100%' = 1,
    '50%',
    '33%',
    '25%',
}

const DynamicTabsContent = ({sections, page, refresh}: { sections: ISection[], page: string, refresh: () => void }) => {
    const deleteSection = async (sectionId: string) => {
        if(!sectionId){
            return;
        }
        const result = await resolve(
            ({mutation}) => {
                const update = {
                    id: sectionId
                }
                return mutation.mongo.removeSectionItem(update)
            },
        );
        console.log(result)
        refresh()
    }
    return (
        <div>
            <div>
                {
                    sections.map((section: ISection) => {
                            const emptySections = section.type - section.content?.length
                            if(emptySections > 0){
                                const emptySection = {
                                    type: "EMPTY"
                                }
                                for(let i = 0; i < emptySections; i++){
                                    section.content?.push(emptySection)
                                }
                            }
                            return (
                                <EditWrapper deleteAction={() => {
                                    deleteSection(section.id)
                                }}>
                                    <SectionContent content={section.content}/>
                                </EditWrapper>
                            )
                        }
                    )
                }
            </div>
            <div>
                <AddNewSection refresh={() => {
                    refresh()
                }} page={page}/>
            </div>
        </div>
    )
}

export default DynamicTabsContent