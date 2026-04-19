import {Collection} from 'mongodb';
import guid from "../helpers/guid";
import {INavigation} from "../Interfaces/INavigation";
import {ISection} from "../Interfaces/ISection";
import {InSection} from "../Interfaces/IMongo";
import {INavigationService} from "./mongoConfig";
import {validateSectionInput} from "../utils/contentSchemas";
import {auditStamp} from "./audit";
import {nextVersion, requireVersion} from "./conflict";

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

    async updateNavigation(page: string, sections: string[], editedBy?: string): Promise<string> {
        try {
            // Filter on the canonical shape so we only touch navigation docs,
            // and `$setOnInsert` backfills `id`/`type`/`seo` when upsert
            // creates a new doc — preventing malformed rows with only
            // `{page, sections}` that other queries miss.
            // Mongo forbids `$setOnInsert` on fields already in the filter
            // (it infers them from the query), so `type` + `page` come from
            // the filter itself; we only need to backfill `id` / `seo` on insert.
            await this.navigationDB.updateOne(
                { type: 'navigation', page },
                {
                    $set: { sections, ...auditStamp(editedBy) },
                    $setOnInsert: { id: guid(), seo: {} },
                },
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
            // Filter to canonical-shape nav docs only. Earlier versions of
            // `updateNavigation` could upsert bare `{page, sections}` rows
            // (no `type` field) that survive in the DB forever. If they leak
            // into this list, the admin renders duplicate pages and stale
            // orders "reset" on reload from the ghost row.
            const docs = await this.navigationDB.find({type: 'navigation'}).toArray();
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
            // `$in` returns documents in Mongo's natural / insertion order,
            // not in the order requested. Re-sort by the caller's list so
            // the Navigation.sections array (which is the source of truth
            // for page layout + reorder operations) round-trips correctly.
            // Without this, dragging a section into a new position briefly
            // shows the new layout, then snaps back when the next refresh
            // reads sections back in insertion order.
            const order = new Map(sectionIds.map((id, i) => [id, i]));
            const ordered = docs.slice().sort((a: any, b: any) => {
                const ia = order.get(a.id as string) ?? Number.MAX_SAFE_INTEGER;
                const ib = order.get(b.id as string) ?? Number.MAX_SAFE_INTEGER;
                return ia - ib;
            });
            return ordered.map(doc => doc as unknown as ISection);
        } catch (err) {
            console.error('Error getting sections:', err);
            await this.setupClient();
            return [];
        }
    }

    async addUpdateSectionItem(item: { section: InSection, pageName?: string, editedBy?: string, expectedVersion?: number | null }): Promise<string> {
        const check = validateSectionInput(item.section);
        if (!check.valid) {
            return JSON.stringify({error: `Invalid section: ${check.error}`});
        }
        const now = new Date().toISOString();
        const audit = {editedAt: now, ...(item.editedBy ? {editedBy: item.editedBy} : {})};
        try {
            if (!item.section.id) {
                const newSection = {...item.section, id: guid(), version: 1, ...audit};
                await this.sectionsDB.insertOne(newSection);
                if (item.pageName) {
                    const nav = await this.navigationDB.findOne({type: 'navigation', page: item.pageName});
                    if (nav) {
                        const sections: string[] = Array.isArray((nav as any).sections) ? (nav as any).sections : [];
                        sections.push(newSection.id);
                        await this.navigationDB.updateOne(
                            {type: 'navigation', page: item.pageName},
                            {$set: {sections, ...audit}}
                        );
                    }
                }
                return JSON.stringify({createSection: {id: newSection.id, version: 1}});
            }
            const existing = await this.sectionsDB.findOne({id: item.section.id});
            if (!existing) {
                return JSON.stringify({error: `Section ${item.section.id} not found`});
            }
            const existingVersion = (existing as any)?.version as number | undefined;
            requireVersion(existing, existingVersion, item.expectedVersion, `Section ${item.section.id}`);
            const version = nextVersion(existingVersion);
            await this.sectionsDB.updateOne(
                {id: item.section.id},
                {$set: {...item.section, version, ...audit}}
            );
            return JSON.stringify({updateSection: {id: item.section.id, version}});
        } catch (err) {
            // ConflictError carries `.conflict === true` — the mongoDBConnection
            // wrapper detects it and serialises the JSON response. Other
            // errors fall through to the generic error path.
            if ((err as {conflict?: boolean})?.conflict) throw err;
            console.error('Error adding/updating section item:', err);
            await this.setupClient();
            return '';
        }
    }

    async removeSectionItem(sectionId: string): Promise<string> {
        try {
            const result = await this.sectionsDB.deleteOne({ id: sectionId });
            await this.navigationDB.updateMany(
                { sections: sectionId },
                { $pull: { sections: sectionId } } as any,
            );
            return JSON.stringify({removeSectionItem: {id: sectionId, deleted: result.deletedCount}});
        } catch (err) {
            console.error('Error removing section item:', err);
            await this.setupClient();
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async replaceUpdateNavigation(oldPageName: string, navigation: INavigation, editedBy?: string): Promise<string> {
        try {
            const audit = auditStamp(editedBy);
            const result: { navigation: any, sections: any } = {navigation: undefined, sections: undefined};
            if (oldPageName !== navigation.page) {
                result.sections = await this.navigationDB.updateMany(
                    {page: oldPageName},
                    {$set: {page: navigation.page}}
                );
            }
            result.navigation = await this.navigationDB.findOneAndUpdate(
                {type: 'navigation', id: navigation.id},
                {$set: {...navigation, ...audit}}
            );
            return JSON.stringify(result);
        } catch (err) {
            console.error('Error replacing navigation:', err);
            await this.setupClient();
            return 'Error while fetching navigation data';
        }
    }

    async deleteNavigationItem(pageName: string, deletedBy?: string): Promise<string> {
        try {
            const existing = await this.navigationDB.findOne({type: 'navigation', page: pageName});
            if (!existing) {
                return 'no navigation found for page:' + pageName;
            }
            // Cascade — a nav doc owns its referenced sections. Without this,
            // every `delete page` leaves the Sections collection full of
            // orphan rows that still appear in exports and snapshots.
            const sectionIds = Array.isArray((existing as any).sections) ? (existing as any).sections as string[] : [];
            let sectionsDeleted = 0;
            if (sectionIds.length > 0) {
                const sectionResult = await this.sectionsDB.deleteMany({id: {$in: sectionIds}});
                sectionsDeleted = sectionResult.deletedCount ?? 0;
            }
            const result = await this.navigationDB.deleteOne({type: 'navigation', page: pageName});
            return JSON.stringify({navigationDeleted: result.deletedCount ?? 0, sectionsDeleted, deletedBy});
        } catch (err) {
            console.error('Error deleting navigation:', err);
            await this.setupClient();
            return '';
        }
    }

    async addUpdateNavigationItem(pageName: string, sections?: string[], editedBy?: string): Promise<string> {
        try {
            const audit = auditStamp(editedBy);
            const existing = await this.navigationDB.findOne({type: 'navigation', page: pageName});
            if (!existing) {
                const navigationItem: INavigation & {editedAt?: string; editedBy?: string} = {
                    id: guid(),
                    type: 'navigation',
                    page: pageName,
                    seo: {},
                    sections: sections ?? [],
                    ...audit,
                };
                const result = await this.navigationDB.insertOne(navigationItem);
                return JSON.stringify(result);
            }
            const update: any = sections ? {sections, ...audit} : audit;
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
