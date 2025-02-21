import {IImage, InImage, resolve} from "../gqty";
import {IMongo, InSection, MutationMongo} from "../../Interfaces/IMongo";
import {ISection} from "../../Interfaces/ISection";
import {IConfigSectionAddRemove} from "../../Interfaces/IConfigSectionAddRemove";
import {IPage} from "../../Interfaces/IPage";
import {INavigation} from "../../Interfaces/INavigation";
import {IItem} from "../../Interfaces/IItem";
import {ILogo} from "../../Interfaces/ILogo";
import {IUser} from "../../Interfaces/IUser";

class MongoApi {
    async getUser({email}: {email: string}): Promise<Partial<IUser> | any> {
        const user = await resolve(
            ({query}) => {
                const user = query.mongo.getUser({email})
                return {
                    id: user?.id,
                    name: user?.name,
                    email: user?.email,
                    password: user?.password,
                }
            },
        )
        return user
    }
    async getLogo(): Promise<ILogo> {
        const logo = await resolve(
            ({query}) => {
                const logo = query.mongo.getLogo
                return {
                    type: logo.type,
                    content: logo.content,
                    id: logo.id,
                }
            },
        )
        return logo
    }
    async saveLogo(content: string): Promise<void> {
        await resolve(
            ({mutation}) => {
                return (mutation).mongo.saveLogo({content: content})
            },
        )
    }

    async saveImage(image: InImage): Promise<any> {
        return await resolve(
            ({mutation}) => {
                return (mutation).mongo.saveImage({image})
            },
        )
    }

    async deleteImage(id: string): Promise<any> {
        return await resolve(
            ({mutation}) => {
                return (mutation).mongo.deleteImage({id})
            },
        )
    }

    async getImages(tags: string): Promise<IImage[]> {
        return await resolve(
            ({query}) => {
                return query.mongo.getImages({tags}).map(image => {
                    return {
                        created: image.created,
                        id: image.id,
                        location: image.location,
                        name: image.name,
                        size: image.size,
                        tags: image.tags,
                        type: image.type
                    }
                })
            },
        )
    }

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

    async updateNavigation(page: string, sections: string[]): Promise<string> {
        return await resolve(
            ({mutation}) => {
                const update: { page: string, sections: string[] } = {
                    page: page,
                    sections: sections
                }
                console.log(update)
                return mutation.mongo.updateNavigation(update)
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
        if (!navigationItem) {
            return ''
        }
        const sections: string[] | undefined = navigationItem.sections
        if (sections) {
            for (let id in sections) {
                if (typeof sections[id] === 'string') {
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

    async addRemoveSectionItem(sectionId: string | undefined, config: IConfigSectionAddRemove, sections: ISection[]): Promise<string> {
        const section = sections.find(section => section.id === sectionId)
        if (!section) {
            console.log('no section to add item to')
            return '';
        }
        section.content[config.index] = {
            type: config.type,
            content: config.content,
            action: config.action,
            actionType: config.actionType,
            actionContent: config.actionContent
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
                                    content: value.content,
                                    action: value.action,
                                    actionType: value.actionType,
                                    actionContent: value.actionContent
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
                    }
                );
            }
        }
        return []
    }
}

export default MongoApi