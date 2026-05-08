import React from 'react';
import {resolve} from "@services/api/generated";
import {IMongo} from "@interfaces/IMongo";
import {INavigation} from "@interfaces/INavigation";
import DynamicTabsContent from "@client/lib/DynamicTabsContent";
import MongoApi from '@services/api/client/MongoApi';
import {TFunction} from "i18next";

interface LoadArgs {
    mongoApi: MongoApi;
    t: TFunction<"translation", undefined>;
    tApp: TFunction<string, undefined>;
    admin: boolean;
    onRefresh: () => Promise<void>;
}

export interface LoadResult {
    pages: any[];
    tabProps: any[];
    sectionsByPage: Record<string, any[]>;
}

/**
 * Fetch the navigation pages collection, graft `parent`/`slug` onto each row
 * (gqty regen still pending for those fields), then build the `tabProps`
 * array AdminApp drives the sider + content panel from. The
 * DynamicTabsContent child is keyed by page name so React remounts on page
 * switch — see comment inline.
 */
export async function loadNavigationPages(args: LoadArgs): Promise<LoadResult> {
    const {mongoApi, t, tApp, admin, onRefresh} = args;

    const pages = await resolve(
        ({query}) => {
            const list: any[] = [];
            (query as unknown as IMongo).mongo.getNavigationCollection.map((item: INavigation) => {
                let itemSeo;
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
                    };
                }
                return list.push({
                    page: item.page,
                    id: item.id,
                    type: item.type,
                    // F1 sub-pages — `parent` and `slug` feed the sider
                    // tree builder + breadcrumb. Reads return undefined
                    // for legacy rows, treated as roots.
                    parent: (item as any).parent,
                    slug: (item as any).slug,
                    seo: itemSeo,
                    sections: item.sections,
                    editedBy: (item as any).editedBy,
                    editedAt: (item as any).editedAt,
                });
            });
            return list;
        }
    );

    // F1 sub-pages — gqty doesn't yet expose `parent` / `slug` on
    // INavigation (regen pending). Pull them via raw GraphQL and
    // graft onto each page so the sider tree builds correctly.
    try {
        const ps = await mongoApi.fetchNavigationParentSlugMap();
        for (const p of pages) {
            const extra = ps.get((p as any).id);
            if (extra) {
                (p as any).parent = extra.parent;
                (p as any).slug = extra.slug;
            }
        }
    } catch (err) { console.warn('parent/slug graft failed', err); }

    const tabProps: any[] = [];
    const sectionsByPage: Record<string, any[]> = {};
    if (pages[0]) {
        for (let id in pages) {
            if (pages[id]) {
                const sectionsData: any[] = await mongoApi.loadSections(pages[id].page, pages);
                sectionsByPage[pages[id].page] = sectionsData;
                tabProps.push({
                    key: id,
                    page: pages[id].page,
                    // F1 sub-pages — carry id/parent so `renderMenuItems`
                    // can build the nested submenu structure and
                    // `deletePage` can offer the cascade prompt.
                    id: (pages[id] as any).id,
                    parent: (pages[id] as any).parent,
                    editedBy: (pages[id] as any).editedBy,
                    editedAt: (pages[id] as any).editedAt,
                    // Key by page name so React remounts `DynamicTabsContent` when the
                    // admin switches pages in the sidebar — the class stores
                    // `sections` on mount and never re-syncs from props.
                    children: (
                        <DynamicTabsContent
                            key={`page-${pages[id].page}`}
                            t={t}
                            tApp={tApp}
                            page={pages[id].page}
                            admin={admin}
                            sections={sectionsData}
                            refresh={onRefresh}
                        />
                    ),
                });
            }
        }
    }

    return {pages, tabProps, sectionsByPage};
}
