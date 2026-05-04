import {resolve, invalidateCache} from "@services/api/generated";
import {IMongo, MutationMongo} from "@interfaces/IMongo";
import {INavigation} from "@interfaces/INavigation";
import {refreshBus} from "@client/lib/refreshBus";
import {triggerRevalidate} from "@client/lib/triggerRevalidate";
import {log} from "@services/infra/logger";

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
        // F1 sub-pages — `parent` round-trips through `InNavigation`.
        // `setParent` is still used for moves on existing rows because
        // it runs the cycle / depth-cap validation; `replaceUpdate` /
        // `createNavigation` write `parent` directly without that gate.
        parent: nav.parent,
        // F1 follow-up — `slug` is now JSON scalar. Pass through
        // either a bare string (legacy single-locale) or a
        // `Record<locale, slug>`; server stores whichever shape it
        // receives.
        slug: nav.slug,
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
            // Navigation changes (create / rename / reorder / delete) alter
            // the getStaticPaths set and the tab bar, so every public page
            // needs to regen to see the new page list.
            triggerRevalidate({scope: 'all'});
            return r;
        } catch (err) {
            log.error({scope: 'navigation.create', err}, 'navigation create failed');
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
            // Navigation changes (create / rename / reorder / delete) alter
            // the getStaticPaths set and the tab bar, so every public page
            // needs to regen to see the new page list.
            triggerRevalidate({scope: 'all'});
            return r;
        } catch (err) {
            log.error({scope: 'navigation.replace', err}, 'navigation replace failed');
            return '';
        }
    }

    async updateNavigation(page: string, sections: string[]): Promise<string> {
        try {
            const r = await resolve(({mutation}) => mutation.mongo.updateNavigation({page, sections}));
            invalidateCache();
            refreshBus.emit('content');
            // Navigation changes (create / rename / reorder / delete) alter
            // the getStaticPaths set and the tab bar, so every public page
            // needs to regen to see the new page list.
            triggerRevalidate({scope: 'all'});
            return r;
        } catch (err) {
            log.error({scope: 'navigation.update', err}, 'navigation update failed');
            return '';
        }
    }

    /**
     * F1 sub-pages — fetch `{id, parent, slug}` per navigation row via
     * the typed gqty proxy. Returns a Map keyed by `id` so callers can
     * graft `parent`/`slug` onto the existing nav list.
     */
    async fetchParentSlugMap(): Promise<Map<string, {parent?: string; slug?: string}>> {
        try {
            const rows = await resolve(({query}) => {
                return (query as unknown as IMongo).mongo.getNavigationCollection.map((item: any) => ({
                    id: item.id,
                    parent: item.parent,
                    slug: item.slug,
                }));
            });
            const out = new Map<string, {parent?: string; slug?: string}>();
            for (const row of rows) {
                if (row?.id) out.set(row.id, {parent: row.parent ?? undefined, slug: row.slug ?? undefined});
            }
            return out;
        } catch (err) {
            log.error({scope: 'navigation.fetchParentSlugMap', err}, 'failed');
            return new Map();
        }
    }

    /**
     * F2 — fetch `{id, page}` per Navigation row for the admin Post-pin
     * Select. Returns the raw list so the caller controls display order
     * / formatting. Posts pin by Navigation `id` (not slug / page name)
     * so a rename on the page doesn't break the pin.
     */
    async fetchPageList(): Promise<{id: string; page: string}[]> {
        try {
            const rows = await resolve(({query}) => {
                return (query as unknown as IMongo).mongo.getNavigationCollection.map((item: any) => ({
                    id: item.id,
                    page: item.page,
                }));
            });
            return rows
                .filter((r: any) => r?.id && r?.page)
                .map((r: any) => ({id: r.id as string, page: r.page as string}));
        } catch (err) {
            log.error({scope: 'navigation.fetchPageList', err}, 'failed');
            return [];
        }
    }

    /**
     * F1 sub-pages — point a page at a new parent (or detach with `null`).
     * Server (`NavigationService.setParent`) enforces cycle / depth /
     * not-found rules. Called from the admin sider's "Move under…" action
     * and the Add/Edit page dialog's Parent Select.
     */
    async setParent(pageId: string, parentId: string | null): Promise<{ok: boolean; error?: string}> {
        try {
            const r = await resolve(({mutation}) =>
                (mutation as MutationMongo).mongo.setParent({pageId, parentId})) as string;
            // Server returns `{error: 'cycle'|'depth-cap'|'not-found'|'slug-conflict'}`
            // serialised as JSON on validation failures, otherwise
            // `{setParent: {...}}` on success.
            try {
                const parsed = JSON.parse(r ?? '{}');
                if (parsed?.error) {
                    log.error({scope: 'navigation.setParent', err: parsed.error, pageId, parentId}, 'setParent failed');
                    return {ok: false, error: parsed.error};
                }
            } catch { /* non-JSON response treated as success */ }
            invalidateCache();
            refreshBus.emit('content');
            triggerRevalidate({scope: 'all'});
            return {ok: true};
        } catch (err) {
            log.error({scope: 'navigation.setParent', err, pageId, parentId}, 'setParent failed');
            return {ok: false, error: String((err as Error)?.message ?? err)};
        }
    }

    async deleteNavigation(pageName: string, opts: {idempotencyKey?: string} = {}): Promise<string> {
        try {
            // Call the proper `deleteNavigationItem` mutation — it drops the
            // Navigation doc AND cascades the section deletes server-side.
            // Previously this only removed the referenced Sections via
            // `removeSectionItem` calls, leaving the Navigation doc alive,
            // so the page reappeared on the next page-fetch with empty
            // content and users saw "delete doesn't stick".
            const args: any = {pageName};
            if (opts.idempotencyKey) args.idempotencyKey = opts.idempotencyKey;
            const r = await resolve(({mutation}) =>
                (mutation as MutationMongo).mongo.deleteNavigationItem(args));
            invalidateCache();
            refreshBus.emit('content');
            // Navigation changes (create / rename / reorder / delete) alter
            // the getStaticPaths set and the tab bar, so every public page
            // needs to regen to see the new page list.
            triggerRevalidate({scope: 'all'});
            return r;
        } catch (err) {
            log.error({scope: 'navigation.delete', err}, 'navigation delete failed');
            return '';
        }
    }
}

export default NavigationApi;
