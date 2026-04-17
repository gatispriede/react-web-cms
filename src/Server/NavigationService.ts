import {Collection} from 'mongodb';
import guid from "../helpers/guid";
import {INavigation} from "../Interfaces/INavigation";
import {ISection} from "../Interfaces/ISection";
import {InSection} from "../Interfaces/IMongo";
import {INavigationService} from "./mongoConfig";
import {validateSectionInput} from "../utils/contentSchemas";

export class NavigationService implements INavigationService{
    private navigationDB: Collection;
    private sectionsDB: Collection;
    private setupClient: () => Promise<void>;

    constructor(navigationDB: Collection, sectionsDB: Collection, setupClient: () => Promise<void>) {
        this.navigationDB = navigationDB;
        this.sectionsDB = sectionsDB;
        this.setupClient = setupClient;
    }

    async createNavigation(newNavigation: INavigation): Promise<string> {
        try {
            const result = await this.navigationDB.insertOne(newNavigation);
            return result.insertedId?.toString() || '';
        } catch (err) {
            console.error('Error creating navigation:', err);
            await this.setupClient();
            return '';
        }
    }

    async updateNavigation(page: string, sections: string[]): Promise<string> {
        try {
            await this.navigationDB.updateOne(
                { page },
                { $set: { sections } },
                { upsert: true }
            );
            return 'success';
        } catch (err) {
            console.error('Error updating navigation:', err);
            await this.setupClient();
            return '';
        }
    }

    async getNavigationCollection(): Promise<INavigation[]> {
        try {
            const docs = await this.navigationDB.find({}).toArray();
            return docs.map(doc => doc as unknown as INavigation);
        } catch (err) {
            console.error('Error getting navigation collection:', err);
            await this.setupClient();
            return [];
        }
    }

    async getSections(sectionIds: string[]): Promise<ISection[]> {
        try {
            const docs = await this.sectionsDB.find({ id: { $in: sectionIds } }).toArray();
            return docs.map(doc => doc as unknown as ISection);
        } catch (err) {
            console.error('Error getting sections:', err);
            await this.setupClient();
            return [];
        }
    }

    async addUpdateSectionItem(item: { section: InSection, pageName?: string }): Promise<string> {
        try {
            const check = validateSectionInput(item.section);
            if (!check.valid) {
                return JSON.stringify({error: `Invalid section: ${check.error}`});
            }
            if (!item.section.id) {
                const newSection = {...item.section, id: guid()};
                await this.sectionsDB.insertOne(newSection);
                if (item.pageName) {
                    const nav = await this.navigationDB.findOne({type: 'navigation', page: item.pageName});
                    if (nav) {
                        const sections: string[] = Array.isArray((nav as any).sections) ? (nav as any).sections : [];
                        sections.push(newSection.id);
                        await this.navigationDB.updateOne(
                            {type: 'navigation', page: item.pageName},
                            {$set: {sections}}
                        );
                    }
                }
                return JSON.stringify({createSection: {id: newSection.id}});
            }
            await this.sectionsDB.updateOne(
                {id: item.section.id},
                {$set: item.section}
            );
            return JSON.stringify({updateSection: {id: item.section.id}});
        } catch (err) {
            console.error('Error adding/updating section item:', err);
            await this.setupClient();
            return '';
        }
    }

    async removeSectionItem(sectionId: string): Promise<string> {
        try {
            await this.sectionsDB.deleteOne({ id: sectionId });
            return 'success';
        } catch (err) {
            console.error('Error removing section item:', err);
            await this.setupClient();
            return '';
        }
    }

    async replaceUpdateNavigation(oldPageName: string, navigation: INavigation): Promise<string> {
        try {
            const result: { navigation: any, sections: any } = {navigation: undefined, sections: undefined};
            if (oldPageName !== navigation.page) {
                result.sections = await this.navigationDB.updateMany(
                    {page: oldPageName},
                    {$set: {page: navigation.page}}
                );
            }
            result.navigation = await this.navigationDB.findOneAndUpdate(
                {type: 'navigation', id: navigation.id},
                {$set: navigation}
            );
            return JSON.stringify(result);
        } catch (err) {
            console.error('Error replacing navigation:', err);
            await this.setupClient();
            return 'Error while fetching navigation data';
        }
    }

    async deleteNavigationItem(pageName: string): Promise<string> {
        try {
            const existing = await this.navigationDB.findOne({type: 'navigation', page: pageName});
            if (!existing) {
                return 'no navigation found for page:' + pageName;
            }
            const result = await this.navigationDB.deleteOne({type: 'navigation', page: pageName});
            return JSON.stringify(result);
        } catch (err) {
            console.error('Error deleting navigation:', err);
            await this.setupClient();
            return '';
        }
    }

    async addUpdateNavigationItem(pageName: string, sections?: string[]): Promise<string> {
        try {
            const existing = await this.navigationDB.findOne({type: 'navigation', page: pageName});
            if (!existing) {
                const navigationItem: INavigation = {
                    id: guid(),
                    type: 'navigation',
                    page: pageName,
                    seo: {},
                    sections: sections ?? []
                };
                const result = await this.navigationDB.insertOne(navigationItem);
                return JSON.stringify(result);
            }
            const update: Partial<INavigation> = sections ? {sections} : {};
            const result = await this.navigationDB.findOneAndUpdate(
                {type: 'navigation', page: pageName},
                {$set: update}
            );
            return JSON.stringify(result);
        } catch (err) {
            console.error('Error add/update navigation:', err);
            await this.setupClient();
            return '';
        }
    }
}
