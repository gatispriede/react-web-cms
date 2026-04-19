import {resolve, invalidateCache} from "../gqty";
import {IMongo, MutationMongo} from "../../Interfaces/IMongo";
import {INavigation} from "../../Interfaces/INavigation";
import {refreshBus} from "../lib/refreshBus";

/**
 * Audit fields (`editedBy` / `editedAt`) are output-only — the `InNavigation`
 * GraphQL input doesn't accept them. Leaving them on the payload 400s the
 * mutation with "Variable got invalid value …".
 */
function toInNavigation(nav: INavigation): any {
    const seo = nav.seo ? {
        description: nav.seo.description,
        keywords: nav.seo.keywords,
        viewport: nav.seo.viewport,
        charSet: nav.seo.charSet,
        url: nav.seo.url,
        image: nav.seo.image,
        image_alt: nav.seo.image_alt,
        published_time: (nav.seo as any).published_time,
        modified_time: (nav.seo as any).modified_time,
        author: nav.seo.author,
        locale: nav.seo.locale,
    } : undefined;
    return {
        id: nav.id,
        type: nav.type,
        page: nav.page,
        seo,
        sections: nav.sections ?? [],
    };
}

export class NavigationApi {
    async createNavigation(newNavigation: INavigation): Promise<string> {
        try {
            const r = await resolve(({mutation}) => mutation.mongo.createNavigation({navigation: toInNavigation(newNavigation)}));
            invalidateCache();
            refreshBus.emit('content');
            return r;
        } catch (err) {
            console.error('Error creating navigation:', err);
            return '';
        }
    }

    async replaceUpdateNavigation(oldPageName: string, newNavigation: INavigation): Promise<string> {
        try {
            const r = await resolve(({mutation}) => mutation.mongo.replaceUpdateNavigation({
                oldPageName, navigation: toInNavigation(newNavigation),
            }));
            invalidateCache();
            refreshBus.emit('content');
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
            refreshBus.emit('content');
            return r;
        } catch (err) {
            console.error('Error updating navigation:', err);
            return '';
        }
    }

    async deleteNavigation(pageName: string): Promise<string> {
        try {
            // Call the proper `deleteNavigationItem` mutation — it drops the
            // Navigation doc AND cascades the section deletes server-side.
            // Previously this only removed the referenced Sections via
            // `removeSectionItem` calls, leaving the Navigation doc alive,
            // so the page reappeared on the next page-fetch with empty
            // content and users saw "delete doesn't stick".
            const r = await resolve(({mutation}) =>
                (mutation as MutationMongo).mongo.deleteNavigationItem({pageName}));
            invalidateCache();
            refreshBus.emit('content');
            return r;
        } catch (err) {
            console.error('Error deleting navigation:', err);
            return '';
        }
    }
}

export default NavigationApi;
