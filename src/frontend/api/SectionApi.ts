import {resolve, invalidateCache} from "../gqty";
import {IMongo, InSection, MutationMongo} from "../../Interfaces/IMongo";
import {ISection} from "../../Interfaces/ISection";
import {IItem} from "../../Interfaces/IItem";
import {IPage} from "../../Interfaces/IPage";
import {IConfigSectionAddRemove} from "../../Interfaces/IConfigSectionAddRemove";

export class SectionApi {
    async loadSections(pageName: string, pages: IPage[]): Promise<ISection[]> {
        const page = pages.find(p => p.page === pageName);
        if (!page?.sections?.length) return [];
        return await resolve(({query}) => {
            return (query as unknown as IMongo).mongo.getSections({ids: page.sections}).map(item => ({
                id: item.id,
                type: item.type,
                page: item.page,
                editedBy: (item as any).editedBy,
                editedAt: (item as any).editedAt,
                content: item.content.map((c: IItem) => ({
                    name: c.name,
                    type: c.type,
                    style: c.style,
                    content: c.content,
                    action: c.action,
                    actionStyle: c.actionStyle,
                    actionType: c.actionType,
                    actionContent: c.actionContent,
                })),
            }));
        });
    }

    async deleteSection(sectionId: string): Promise<string> {
        if (!sectionId) return '';
        try {
            const r = await resolve(({mutation}) =>
                (mutation as MutationMongo).mongo.removeSectionItem({id: sectionId}));
            invalidateCache();
            return r;
        } catch (err) {
            console.error('Error deleting section:', err);
            return '';
        }
    }

    async addSectionToPage(item: { section: InSection }, sections: ISection[]): Promise<ISection[]> {
        const result = await resolve(({mutation}) =>
            (mutation as MutationMongo).mongo.addUpdateSectionItem(item));
        invalidateCache();
        try {
            const parsed = JSON.parse(result);
            if (parsed.createSection?.id) {
                item.section.id = parsed.createSection.id;
                sections.push(item.section);
                return sections;
            }
        } catch (err) {
            console.error(err);
        }
        return [];
    }

    async addRemoveSectionItem(
        sectionId: string | undefined,
        config: IConfigSectionAddRemove,
        sections: ISection[]
    ): Promise<string> {
        const section = sections.find(s => s.id === sectionId);
        if (!section) {
            console.error('no section to add item to');
            return '';
        }
        section.content[config.index] = {
            type: config.type,
            style: config.style ?? 'default',
            content: config.content,
            action: config.action,
            actionStyle: config.actionStyle,
            actionType: config.actionType,
            actionContent: config.actionContent,
        };
        if (section.content) {
            section.content = section.content.map((it: IItem) => ({...it, style: it.style || 'default'}));
        }
        const r = await resolve(({mutation}) =>
            mutation.mongo.addUpdateSectionItem({section: section as InSection}));
        invalidateCache();
        return r;
    }
}

export default SectionApi;
