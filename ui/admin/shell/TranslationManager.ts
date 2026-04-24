import {IMongo} from "@interfaces/IMongo";
import {INavigation} from "@interfaces/INavigation";
import MongoApi from "@services/api/client/MongoApi";
import {resolve} from "@services/api/generated";
import {ISection} from "@interfaces/ISection";
import {IItem} from "@interfaces/IItem";
import EItemType from "@enums/EItemType";
import {IPlainImage} from "@client/modules/PlainImage";
import {IPlainTextContent} from "@client/modules/PlainText";
import {ICarousel} from "@client/modules/Carousel";
import {IRichText} from "@client/modules/RichText";
import {IHero} from "@client/modules/Hero";
import {IProjectCard} from "@client/modules/ProjectCard";
import {ISkillPills} from "@client/modules/SkillPills";
import {ITimeline} from "@client/modules/Timeline";
import {ISocialLinks} from "@client/modules/SocialLinks";
import {IBlogFeed} from "@client/modules/BlogFeed";
import {sanitizeKey} from "@utils/stringFunctions";
import {INewLanguage} from "@interfaces/INewLanguage";
import {htmlToBlocks} from "@utils/htmlBlocks";

class TranslationManager {
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
        return await this.getSectionsData();
    }

    async getLanguages(){
        return await this.MongoApi.getLanguages()
    }
    async saveNewLanguage(language: INewLanguage){
        return await this.MongoApi.saveLanguage(language)
    }
    async saveNewTranslation(language: INewLanguage, translations: any, expectedVersion?: number){
        return await this.MongoApi.saveLanguage(language, translations, expectedVersion)
    }
    async deleteTranslation(language: INewLanguage){
        return await this.MongoApi.deleteTranslation(language)
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

                    return list.push({
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
                for (const block of htmlToBlocks((content as IRichText).value)) {
                    this.defaultTranslations[this.contentTranslationKey + sanitizeKey(block.text)] = block.text
                }
                break;
            case EItemType.Image:
                for (const block of htmlToBlocks((content as IPlainImage).description)) {
                    this.defaultTranslations[this.contentTranslationKey + sanitizeKey(block.text)] = block.text
                }
                break;
            case EItemType.Carousel:
                if (content.items.length > 0) {
                    content.items.forEach((item: any) => {
                        if (typeof item.text === 'string' && item.text.length > 0) {
                            return this.defaultTranslations[this.contentTranslationKey + sanitizeKey(item.text)] = item.text
                        }
                    })
                }
                break;
            case EItemType.Gallery:
                if (content.items.length > 0) {
                    content.items.forEach((item: any) => {
                        if (typeof item.text === 'string'  && item.text.length > 0) {
                           return  this.defaultTranslations[this.contentTranslationKey + sanitizeKey(item.text)] = item.text
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
                                this.defaultTranslations[sanitizeKey(contentParsed.value)] = contentParsed.value
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
                            for (const block of htmlToBlocks(contentParsed.value)) {
                                this.defaultTranslations[sanitizeKey(block.text)] = block.text
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
                            for (const block of htmlToBlocks(contentParsed.description)) {
                                this.defaultTranslations[sanitizeKey(block.text)] = block.text
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
                                       return  this.defaultTranslations[sanitizeKey(item.text)] = item.text
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
                                       return  this.defaultTranslations[sanitizeKey(item.text)] = item.text
                                })

                            }
                            const actionContentParsed = innerContent.actionContent && JSON.parse(innerContent.actionContent)
                            if (innerContent.actionType && actionContentParsed)
                                this.extractActionContentTranslations(innerContent.actionType, actionContentParsed)
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err)
                        }
                        break;
                    case EItemType.Hero:
                        try {
                            const c: IHero = JSON.parse(innerContent.content);
                            for (const v of [c.headline, c.subtitle, c.tagline]) {
                                if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                            }
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
                        }
                        break;
                    case EItemType.ProjectCard:
                        try {
                            const c: IProjectCard = JSON.parse(innerContent.content);
                            for (const v of [c.title, c.description]) {
                                if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                            }
                            for (const tag of c.tags ?? []) {
                                if (typeof tag === 'string' && tag) this.defaultTranslations[sanitizeKey(tag)] = tag;
                            }
                            for (const link of [c.primaryLink, c.secondaryLink]) {
                                if (link?.label) this.defaultTranslations[sanitizeKey(link.label)] = link.label;
                            }
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
                        }
                        break;
                    case EItemType.SkillPills:
                        try {
                            const c: ISkillPills = JSON.parse(innerContent.content);
                            if (c.category) this.defaultTranslations[sanitizeKey(c.category)] = c.category;
                            for (const item of c.items ?? []) {
                                if (typeof item === 'string' && item) this.defaultTranslations[sanitizeKey(item)] = item;
                            }
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
                        }
                        break;
                    case EItemType.Timeline:
                        try {
                            const c: ITimeline = JSON.parse(innerContent.content);
                            for (const e of c.entries ?? []) {
                                for (const v of [e.start, e.end, e.company, e.role, e.location]) {
                                    if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                                }
                                for (const a of e.achievements ?? []) {
                                    if (typeof a === 'string' && a) this.defaultTranslations[sanitizeKey(a)] = a;
                                }
                            }
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
                        }
                        break;
                    case EItemType.SocialLinks:
                        try {
                            const c: ISocialLinks = JSON.parse(innerContent.content);
                            for (const link of c.links ?? []) {
                                if (link?.label) this.defaultTranslations[sanitizeKey(link.label)] = link.label;
                            }
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
                        }
                        break;
                    case EItemType.BlogFeed:
                        try {
                            const c: IBlogFeed = JSON.parse(innerContent.content);
                            if (c.heading) this.defaultTranslations[sanitizeKey(c.heading)] = c.heading;
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
                        }
                        break;
                    case EItemType.List:
                        try {
                            const c: {title?: string; items?: {label?: string; value?: string}[]} = JSON.parse(innerContent.content);
                            if (c.title) this.defaultTranslations[sanitizeKey(c.title)] = c.title;
                            for (const li of c.items ?? []) {
                                if (li?.label) this.defaultTranslations[sanitizeKey(li.label)] = li.label;
                                if (li?.value) this.defaultTranslations[sanitizeKey(li.value)] = li.value;
                            }
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
                        }
                        break;
                    case EItemType.Services:
                        try {
                            const c: {sectionNumber?: string; sectionTitle?: string; sectionSubtitle?: string; rows?: {number?: string; title?: string; description?: string; ctaLabel?: string}[]} = JSON.parse(innerContent.content);
                            for (const v of [c.sectionNumber, c.sectionTitle, c.sectionSubtitle]) {
                                if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                            }
                            for (const r of c.rows ?? []) {
                                for (const v of [r.number, r.title, r.description, r.ctaLabel]) {
                                    if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                                }
                            }
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
                        }
                        break;
                    case EItemType.Testimonials:
                        try {
                            const c: {sectionTitle?: string; sectionSubtitle?: string; items?: {quote?: string; name?: string; role?: string}[]} = JSON.parse(innerContent.content);
                            for (const v of [c.sectionTitle, c.sectionSubtitle]) {
                                if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                            }
                            for (const q of c.items ?? []) {
                                for (const v of [q.quote, q.name, q.role]) {
                                    if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                                }
                            }
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
                        }
                        break;
                    case EItemType.ProjectGrid:
                        try {
                            const c: {sectionNumber?: string; sectionTitle?: string; sectionSubtitle?: string; items?: {title?: string; stack?: string; kind?: string; year?: string; moreLabel?: string}[]} = JSON.parse(innerContent.content);
                            for (const v of [c.sectionNumber, c.sectionTitle, c.sectionSubtitle]) {
                                if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                            }
                            for (const p of c.items ?? []) {
                                for (const v of [p.title, p.stack, p.kind, p.year, p.moreLabel]) {
                                    if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                                }
                            }
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
                        }
                        break;
                    case EItemType.Manifesto:
                        try {
                            const c: {body?: string; addendum?: string} = JSON.parse(innerContent.content);
                            for (const v of [c.body, c.addendum]) {
                                if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                            }
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
                        }
                        break;
                    case EItemType.StatsCard:
                        try {
                            const c: {tag?: string; title?: string; stats?: {value?: string; label?: string}[]; features?: {text?: string}[]} = JSON.parse(innerContent.content);
                            for (const v of [c.tag, c.title]) {
                                if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                            }
                            for (const s of c.stats ?? []) {
                                for (const v of [s.value, s.label]) {
                                    if (typeof v === 'string' && v) this.defaultTranslations[sanitizeKey(v)] = v;
                                }
                            }
                            for (const f of c.features ?? []) {
                                if (typeof f?.text === 'string' && f.text) this.defaultTranslations[sanitizeKey(f.text)] = f.text;
                            }
                        } catch (err) {
                            console.warn('Error while extracting translations for section', section.id, err);
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
            defaultTranslations[sanitizeKey(navigation.page)] = navigation.page;
        })
        this.defaultTranslations = defaultTranslations;
        this.extractContentTranslations()

        return this.defaultTranslations;
    }

}

export default TranslationManager;