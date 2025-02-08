import {resolve} from "../gqty";
import {IMongo, InSection, MutationMongo} from "../../Interfaces/IMongo";
import {ISection} from "../../Interfaces/ISection";
import {IConfigSectionAddRemove} from "../../Interfaces/IConfigSectionAddRemove";
import {IPage} from "../../Interfaces/IPage";
import {INavigation} from "../../Interfaces/INavigation";
import {IItem} from "../../Interfaces/IItem";
import { unstable_cache } from 'next/cache'

class MongoApi {
    async deleteSection(sectionId: string): Promise<string> {
        if (!sectionId) {
            return '';
        }
        return await resolve(
            ({mutation}) => {
                const update = {
                    id: sectionId
                }
                return (mutation as MutationMongo).mongo.removeSectionItem(update)
            },
        )
    }

    async createNavigation(newNavigationName: string, sections: string[]): Promise<string> {
        return await resolve(
            ({mutation}) => {
                const update: { pageName: string, sections: string[] } = {
                    pageName: newNavigationName,
                    sections: []
                }
                if (sections.length > 0) {
                    update.sections = sections
                }
                return (mutation as MutationMongo).mongo.addUpdateNavigationItem(update)
            },
        );
    }
    async deleteNavigation(pageName: string): Promise<string> {
        const NavigationCollection = await resolve(
            ({query}) => {
                const list: INavigation[] = [];
                (query as unknown as IMongo).mongo.getNavigationCollection.map(item => {
                    list.push({
                        id: item.id,
                        page: item.page,
                        sections: item.sections,
                        type: item.type
                    })
                })
                return list
            },
        )
        const navigationItem = NavigationCollection.find(item => item.page === pageName)
        if(!navigationItem){
            return ''
        }
        const sections: string[] | undefined = navigationItem.sections
        if (sections) {
            for (let id in sections) {
                if(typeof sections[id] === 'string') {
                    await resolve(
                        ({mutation}) => {
                            return (mutation as MutationMongo).mongo.removeSectionItem({id: sections[id]})
                        },
                    );
                }
            }
        }
        return await resolve(
            ({mutation}) => {
                const update = {
                    pageName: pageName
                }
                return (mutation as MutationMongo).mongo.deleteNavigationItem(update)
            },
        );
    }

    async addSectionToPage(item: any, sections: ISection[]): Promise<ISection[]> {

        const result = await resolve(
            ({mutation}) => {
                return (mutation as MutationMongo).mongo.addUpdateSectionItem(item)
            },
        );

        try {
            const resultObject = JSON.parse(result)
            if (resultObject.createSection) {
                if (resultObject.createSection.id) {
                    item.section.id = resultObject.createSection.id
                    sections.push(item.section)
                    return sections;
                }
            }
        } catch (err) {
            console.log(err)
        }
        return []
    }

    async addRemoveSectionItem  (sectionId: string | undefined, config: IConfigSectionAddRemove, sections: ISection[]): Promise<string>  {
        const section = sections.find(section => section.id === sectionId)
        if (!section) {
            console.log('no section to add item to')
            return '';
        }
        section.content[config.index] = {
            type: config.type,
            content: config.content
        }
        const input = {
            section: (section as InSection)
        }
        return await resolve(
            ({mutation}) => {
                return (mutation as MutationMongo).mongo.addUpdateSectionItem(input)
            },
        )
    }
    async loadSections(pageName: string, pages: IPage[]): Promise<ISection[]> {
        const page = pages.find(p => p.page === pageName)
        if (page) {
            const sectionIds = page.sections
            if (sectionIds.length > 0) {
                return await resolve(
                    ({query}) => {
                        const list: ISection[] = (query as unknown as IMongo).mongo.getSections({ids: sectionIds}).map(item => {
                            let content: IItem[];
                            content = item.content.map((value: IItem) => {
                                return {
                                    name: value.name,
                                    type: value.type,
                                    content: value.content
                                }
                            })
                            return {
                                id: item.id,
                                type: item.type,
                                page: item.page,
                                content: content
                            }
                        })
                        return list
                    },
                );
            }
        }
        return []
    }
}

export default MongoApi