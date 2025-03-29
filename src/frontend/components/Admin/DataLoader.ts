import {IMongo} from "../../../Interfaces/IMongo";
import {INavigation} from "../../../Interfaces/INavigation";
import MongoApi from "../../api/MongoApi";
import {resolve} from "../../gqty";
import {ISection} from "../../../Interfaces/ISection";
import {IItem} from "../../../Interfaces/IItem";
import EItemType from "../../../enums/EItemType";
import {IPlainImage} from "../SectionComponents/PlainImage";
import {IPlainTextContent} from "../SectionComponents/PlainText";
import {ICarousel} from "../SectionComponents/CarouselView";
import {IRichText} from "../SectionComponents/RichText";
import {sanitizeKey} from "../../../utils/stringFunctions";

class DataLoader {
    MongoApi: MongoApi;
    sectionsIds: string[];
    sections: ISection[];
    pages: INavigation[];
    defaultTranslations: {
        [key: string]: string;
    };
    navigationTranslationKey = ''
    contentTranslationKey = ''

    constructor() {
        this.MongoApi = new MongoApi();
        this.sectionsIds = [];
        this.sections = [];
        this.pages = [];
        this.defaultTranslations = {};
    }

    async loadData() {
        await this.getNavigationData();
        await this.getSectionsData();
    }

    async getNavigationData() {
        let sectionsIds: string[] = [];
        const pages: INavigation[] = await resolve(
            ({query}) => {
                const list: any[] = [];
                (query as unknown as IMongo).mongo.getNavigationCollection.map((item: INavigation) => {
                    let itemSeo
                    if (item.seo) {
                        itemSeo = {
                            description: item.seo.description,
                            keywords: item.seo.keywords,
                            viewport: item.seo.viewport,
                            charSet: item.seo.charSet,
                            url: item.seo.url,
                            image: item.seo.image,
                            image_alt: item.seo.image_alt,
                            author: item.seo.author,
                            locale: item.seo.locale,
                        }
                    }

                    list.push({
                        page: item.page,
                        id: item.id,
                        type: item.type,
                        seo: itemSeo,
                        sections: item.sections
                    })
                })
                return list
            }
        )
        for (let id in pages) {
            sectionsIds = sectionsIds.concat(pages[id].sections)
        }
        this.pages = pages;
        this.sectionsIds = sectionsIds;
        return pages;
    }

    async getSectionsData() {
        this.sections = await resolve(
            ({query}) => {
                const list: ISection[] = (query as unknown as IMongo).mongo.getSections({ids: this.sectionsIds}).map(item => {
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
        return this.sections;
    }

    extractActionContentTranslations(type: any, content: any) {
        switch (type) {
            case EItemType.Text:
                if (content.value && content.value.length > 0) {
                    this.defaultTranslations[this.contentTranslationKey + sanitizeKey(content.value)] = content.value
                }
                break;
            case EItemType.RichText:
                if ((content as IRichText).value.blocks.length > 0) {
                    (content as IRichText).value.blocks.forEach(block => {
                        if (block.text.length > 0)
                            this.defaultTranslations[this.contentTranslationKey + sanitizeKey(block.text)] = block.text
                    })
                }
                break;
            case EItemType.Image:
                if (content.description && (content as IPlainImage).description.blocks.length > 0) {
                    (content as IPlainImage).description.blocks.forEach(block => {
                        if (block.text.length > 0)
                            this.defaultTranslations[this.contentTranslationKey + sanitizeKey(block.text)] = block.text
                    })
                }
                break;
            case EItemType.Carousel:
                if (content.items.length > 0) {
                    content.items.forEach((item: any) => {
                        if (typeof item.text === 'string' && item.text.length > 0) {
                            this.defaultTranslations[this.contentTranslationKey + sanitizeKey(item.text)] = item.text
                        }
                    })
                }
                break;
            case EItemType.Gallery:
                if (content.items.length > 0) {
                    content.items.forEach((item: any) => {
                        if (typeof item.text === 'string'  && item.text.length > 0) {
                            this.defaultTranslations[this.contentTranslationKey + sanitizeKey(item.text)] = item.text
                        }
                    })
                }
                break;
            case EItemType.Empty:
                break;
            default:
                return;
        }
    }

    extractContentTranslations() {
        this.sections.forEach((section: ISection) => {
            section.content.forEach(innerContent => {
                switch (innerContent.type) {
                    case EItemType.Text:
                        try {
                            const contentParsed: IPlainTextContent = JSON.parse(innerContent.content)
                            if (contentParsed.value && contentParsed.value.length > 0) {
                                this.defaultTranslations[this.contentTranslationKey + sanitizeKey(contentParsed.value)] = contentParsed.value
                            }
                            const actionContentParsed = innerContent.actionContent && JSON.parse(innerContent.actionContent)
                            if (innerContent.actionType && actionContentParsed)
                                this.extractActionContentTranslations(innerContent.actionType, actionContentParsed)
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err)
                        }
                        break;
                    case EItemType.RichText:
                        try {
                            const contentParsed: IRichText = JSON.parse(innerContent.content)
                            if (contentParsed.value.blocks.length > 0) {
                                contentParsed.value.blocks.forEach(block => {
                                    if (block.text.length > 0)
                                        this.defaultTranslations[this.contentTranslationKey + sanitizeKey(block.text)] = block.text
                                })
                            }

                            const actionContentParsed = innerContent.actionContent && JSON.parse(innerContent.actionContent)
                            if (innerContent.actionType && actionContentParsed)
                                this.extractActionContentTranslations(innerContent.actionType, actionContentParsed)
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err)
                        }
                        break;
                    case EItemType.Image:
                        try {
                            const contentParsed: IPlainImage = JSON.parse(innerContent.content)
                            if (contentParsed.description && contentParsed.description.blocks.length > 0) {
                                contentParsed.description.blocks.forEach(block => {
                                    if (block.text.length > 0)
                                        this.defaultTranslations[this.contentTranslationKey + sanitizeKey(block.text)] = block.text
                                })
                            }
                            const actionContentParsed = innerContent.actionContent && JSON.parse(innerContent.actionContent)
                            if (innerContent.actionType && actionContentParsed)
                                this.extractActionContentTranslations(innerContent.actionType, actionContentParsed)
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err)
                        }

                        break;
                    case EItemType.Carousel:
                        try {
                            const contentParsed: ICarousel = JSON.parse(innerContent.content)
                            if (contentParsed.items.length > 0) {
                                contentParsed.items.forEach((item) => {
                                    if (item.text.length > 0)
                                        this.defaultTranslations[this.contentTranslationKey + sanitizeKey(item.text)] = item.text
                                })

                            }
                            const actionContentParsed = innerContent.actionContent && JSON.parse(innerContent.actionContent)
                            if (innerContent.actionType && actionContentParsed)
                                this.extractActionContentTranslations(innerContent.actionType, actionContentParsed)
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err)
                        }
                        break;
                    case EItemType.Gallery:
                        try {
                            const contentParsed: ICarousel = JSON.parse(innerContent.content)
                            if (contentParsed.items.length > 0) {
                                contentParsed.items.forEach((item) => {
                                    if (item.text.length > 0)
                                        this.defaultTranslations[this.contentTranslationKey + sanitizeKey(item.text)] = item.text
                                })

                            }
                            const actionContentParsed = innerContent.actionContent && JSON.parse(innerContent.actionContent)
                            if (innerContent.actionType && actionContentParsed)
                                this.extractActionContentTranslations(innerContent.actionType, actionContentParsed)
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err)
                        }
                        break;
                    case EItemType.Empty:
                        break;
                    default:
                        return;
                }
            })

        })
    }

    getTranslations() {
        const defaultTranslations: any = {};
        this.pages.forEach((navigation) => {
            defaultTranslations[this.navigationTranslationKey + navigation.page] = navigation.page;
        })
        this.defaultTranslations = defaultTranslations;
        this.extractContentTranslations()

        return this.defaultTranslations;
    }

}

export default DataLoader;