import {resolve} from "../gqty";
import {IMongo, InSection, MutationMongo} from "../../Interfaces/IMongo";
import IImage, {InImage} from "../../Interfaces/IImage";
import {ISection} from "../../Interfaces/ISection";
import {IConfigSectionAddRemove} from "../../Interfaces/IConfigSectionAddRemove";
import {IPage} from "../../Interfaces/IPage";
import {INavigation} from "../../Interfaces/INavigation";
import {IItem} from "../../Interfaces/IItem";
import {ILogo} from "../../Interfaces/ILogo";
import {IUser} from "../../Interfaces/IUser";
import {INewLanguage} from "../components/interfaces/INewLanguage";

class MongoApi {
    async getUser({email}: { email: string }): Promise<Partial<IUser> | any> {
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

    async getLanguages() {
        try {
            const data = await resolve(
                ({query}) => {
                    const languageList: any = query.mongo.getLanguages;
                    return languageList.map((languageList: any) => {
                        return {
                            default: languageList.default,
                            label: languageList.label,
                            symbol: languageList.symbol,
                        }
                    })

                },
            )
            const dataObject: any = {};
            data.map((data: any) => {
                dataObject[data.symbol] = data;
            })
            return dataObject
        } catch (error) {
            console.error('Error while fetching languages', error)
        }
        return []

    }

    async saveLanguage(language: INewLanguage) {
        await resolve(
            ({mutation}) => {
                return (mutation).mongo.addUpdateLanguage({language: language})
            },
        )
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

    async createNavigation(newNavigation: INavigation): Promise<string> {
        return await resolve(
            ({mutation}) => {
                return (mutation).mongo.createNavigation({navigation: newNavigation})
            },
        );
    }

    async replaceUpdateNavigation(oldNavigationName: string, newNavigation: INavigation): Promise<string> {
        return await resolve(
            ({mutation}) => {
                return (mutation).mongo.replaceUpdateNavigation({
                    oldPageName: oldNavigationName,
                    navigation: newNavigation
                })
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
                        seo: {},
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
            console.error(err)
        }
        return []
    }

    async addRemoveSectionItem(sectionId: string | undefined, config: IConfigSectionAddRemove, sections: ISection[]): Promise<string> {
        const section = sections.find(section => section.id === sectionId)
        if (!section) {
            console.error('no section to add item to')
            return '';
        }
        section.content[config.index] = {
            type: config.type,
            style: config.style ? config.style : 'default',
            content: config.content,
            action: config.action,
            actionStyle: config.actionStyle,
            actionType: config.actionType,
            actionContent: config.actionContent
        }
        const input = {
            section: (section as InSection)
        }
        //@todo remove once update happens
        if (section.content)
            section.content = section.content.map(item => {
                if (!item.style) {
                    item.style = 'default'
                }
                return item
            })
        return await resolve(
            ({mutation}) => {
                return (mutation).mongo.addUpdateSectionItem(input)
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
                            content = item.content.map((item: IItem) => {
                                return {
                                    name: item.name,
                                    type: item.type,
                                    style: item.style,
                                    content: item.content,
                                    action: item.action,
                                    actionStyle: item.actionStyle,
                                    actionType: item.actionType,
                                    actionContent: item.actionContent
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