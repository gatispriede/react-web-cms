import {resolve, invalidateCache} from "../gqty";
import {IMongo, MutationMongo} from "../../Interfaces/IMongo";
import {INavigation} from "../../Interfaces/INavigation";

export class NavigationApi {
    async createNavigation(newNavigation: INavigation): Promise<string> {
        try {
            const r = await resolve(({mutation}) => mutation.mongo.createNavigation({navigation: newNavigation}));
            invalidateCache();
            return r;
        } catch (err) {
            console.error('Error creating navigation:', err);
            return '';
        }
    }

    async replaceUpdateNavigation(oldPageName: string, newNavigation: INavigation): Promise<string> {
        try {
            const r = await resolve(({mutation}) => mutation.mongo.replaceUpdateNavigation({
                oldPageName, navigation: newNavigation,
            }));
            invalidateCache();
            return r;
        } catch (err) {
            console.error('Error replacing/updating navigation:', err);
            return '';
        }
    }

    async updateNavigation(page: string, sections: string[]): Promise<string> {
        try {
            const r = await resolve(({mutation}) => mutation.mongo.updateNavigation({page, sections}));
            invalidateCache();
            return r;
        } catch (err) {
            console.error('Error updating navigation:', err);
            return '';
        }
    }

    async deleteNavigation(pageName: string): Promise<string> {
        try {
            const collection = await resolve(({query}) => {
                const list: INavigation[] = [];
                (query as unknown as IMongo).mongo.getNavigationCollection.map((item: any) =>
                    list.push({id: item.id, page: item.page, sections: item.sections, seo: {}, type: item.type})
                );
                return list;
            });
            const nav = collection.find(item => item.page === pageName);
            if (!nav?.sections) return '';
            for (const id of nav.sections) {
                if (typeof id !== 'string') continue;
                try {
                    await resolve(({mutation}) => (mutation as MutationMongo).mongo.removeSectionItem({id}));
                } catch (err) {
                    console.error('Error removing section item:', err);
                }
            }
            return '';
        } catch (err) {
            console.error('Error deleting navigation:', err);
            return '';
        }
    }
}

export default NavigationApi;
