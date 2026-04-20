import {resolve, invalidateCache} from "../gqty";
import {IMongo, InSection, MutationMongo} from "../../Interfaces/IMongo";
import {ISection} from "../../Interfaces/ISection";
import {IItem} from "../../Interfaces/IItem";
import {IPage} from "../../Interfaces/IPage";
import {IConfigSectionAddRemove} from "../../Interfaces/IConfigSectionAddRemove";
import {refreshBus} from "../lib/refreshBus";
import {parseMutationResponse} from "../lib/conflict";

/**
 * Strip audit / server-only fields before sending a section back through
 * `addUpdateSectionItem`. `InSection` / `InItem` in the GraphQL schema
 * intentionally don't accept `editedBy` / `editedAt` — we stamp those
 * server-side. Passing them through would 400 the mutation with
 * "Variable got invalid value …".
 */
function toInSection(section: ISection): InSection {
    return {
        id: section.id,
        type: section.type,
        page: section.page,
        // InItem.style / .content / .type are all `String!` in the schema, so
        // any item arriving here without those fields (empty-slot fillers
        // pushed by DynamicTabsContent in the past, legacy unpopulated docs)
        // would 400 the mutation with "Variable got invalid value". Default
        // to safe values instead of letting `undefined` through.
        content: (section.content ?? []).map(it => ({
            name: it.name,
            type: it.type ?? 'EMPTY',
            style: typeof it.style === 'string' && it.style ? it.style : 'default',
            content: typeof it.content === 'string' ? it.content : '',
            action: it.action,
            actionStyle: it.actionStyle,
            actionType: it.actionType,
            actionContent: it.actionContent,
            animation: it.animation,
        })),
        ...(Array.isArray(section.slots) ? {slots: section.slots} : {}),
        ...(typeof section.overlay === 'boolean' ? {overlay: section.overlay} : {}),
        ...(typeof section.overlayAnchor === 'string' && section.overlayAnchor ? {overlayAnchor: section.overlayAnchor} : {}),
    } as InSection;
}

export class SectionApi {
    async loadSections(pageName: string, pages: IPage[]): Promise<ISection[]> {
        const page = pages.find(p => p.page === pageName);
        if (!page?.sections?.length) return [];
        return await resolve(({query}) => {
            return (query as unknown as IMongo).mongo.getSections({ids: page.sections}).map(item => ({
                id: item.id,
                type: item.type,
                page: item.page,
                slots: Array.isArray((item as any).slots) ? (item as any).slots as number[] : undefined,
                overlay: typeof (item as any).overlay === 'boolean' ? (item as any).overlay : undefined,
                overlayAnchor: typeof (item as any).overlayAnchor === 'string' ? (item as any).overlayAnchor : undefined,
                version: typeof (item as any).version === 'number' ? (item as any).version : 0,
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
                    animation: c.animation,
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
            refreshBus.emit('content');
            return r;
        } catch (err) {
            console.error('Error deleting section:', err);
            return '';
        }
    }

    async addSectionToPage(
        item: { section: InSection; pageName?: string },
        sections: ISection[],
    ): Promise<ISection[]> {
        const clean = toInSection(item.section as unknown as ISection);
        // Forward `pageName` when present — the server-side resolver only
        // appends the new section's id to the Navigation.sections array
        // when it knows which page the section belongs to. Without it,
        // the Section row exists but the page's layout keeps pointing at
        // the old id list, so the UI-side optimistic push flashes and
        // then disappears on the first refresh.
        const pageName = item.pageName ?? (item.section as any)?.page;
        const result = await resolve(({mutation}) =>
            pageName
                ? (mutation as MutationMongo).mongo.addUpdateSectionItem({section: clean, pageName})
                : (mutation as MutationMongo).mongo.addUpdateSectionItem({section: clean}));
        invalidateCache();
        try {
            const parsed = JSON.parse(result);
            if (parsed.createSection?.id) {
                (item.section as any).id = parsed.createSection.id;
                sections.push(item.section as any);
                refreshBus.emit('content');
                return sections;
            }
        } catch (err) {
            console.error(err);
        }
        refreshBus.emit('content');
        return sections;
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
            animation: config.animation,
        };
        if (section.content) {
            section.content = section.content.map((it: IItem) => ({...it, style: it.style || 'default'}));
        }
        // Stash the version we read from the server. The mutation rejects
        // with `ConflictError` if the on-disk row has moved past us — caller
        // catches and surfaces a `ConflictDialog`. Pass it via `as any`
        // because the GQty `addUpdateSectionItem` arg type was patched to
        // include `expectedVersion` (see schema.generated.ts) but TS may
        // resolve through `MutationMongo` from `IMongo.ts`.
        const expectedVersion = typeof section.version === 'number' ? section.version : undefined;
        const r = await resolve(({mutation}) =>
            (mutation.mongo.addUpdateSectionItem as (args: any) => string)({
                section: toInSection(section),
                ...(expectedVersion !== undefined ? {expectedVersion} : {}),
            }));
        invalidateCache();
        refreshBus.emit('content');
        // Surface the bumped version back into local state so subsequent
        // edits stay conflict-aware. Throws ConflictError on conflict.
        const parsed = parseMutationResponse<{updateSection?: {version?: number}; createSection?: {version?: number}}>(r);
        const bumped = parsed?.updateSection?.version ?? parsed?.createSection?.version;
        if (typeof bumped === 'number') section.version = bumped;
        return r;
    }
}

export default SectionApi;
