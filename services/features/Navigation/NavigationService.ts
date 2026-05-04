import {Collection} from 'mongodb';
import guid from "@utils/guid";
import {INavigation} from "@interfaces/INavigation";
import {ISection} from "@interfaces/ISection";
import {InSection} from "@interfaces/IMongo";
import {INavigationService} from "@services/infra/mongoConfig";
import {validateSectionInput} from "@utils/contentSchemas";
import {assertNotReservedPageSlug} from "@utils/reservedSlugs";
import {auditStamp} from "@services/features/Audit/audit";
import {nextVersion, requireVersion} from "@services/infra/conflict";
import {log} from "@services/infra/logger";
import {slugifyAnchor} from "@utils/stringFunctions";

/**
 * F1 sub-pages — depth cap is root + 2 child levels = max chain length 3.
 * Server-side enforcement is the source of truth (covers MCP / API callers
 * that bypass the admin UI).
 */
const MAX_PAGE_DEPTH = 3;

/**
 * F1 follow-up — pick a slug from a `string | Record<locale, string>`
 * with the documented fallback chain:
 *   1. `slug[locale]` if Record + entry present
 *   2. `slug[defaultLocale]` if Record
 *   3. bare-string `slug` (legacy single-locale)
 *   4. `slugifyAnchor(page)` for legacy rows without a slug
 *
 * Exported so the GraphQL `slug` resolver can also normalise the
 * Record shape down to a plain string when the client doesn't
 * understand the new shape (back-compat for older bundles).
 */
export function resolveSlug(
    slug: string | Record<string, string> | undefined | null,
    page: string,
    locale?: string,
    defaultLocale?: string,
): string {
    if (slug && typeof slug === 'object' && !Array.isArray(slug)) {
        const map = slug as Record<string, string>;
        if (locale && typeof map[locale] === 'string' && map[locale].length > 0) return map[locale];
        if (defaultLocale && typeof map[defaultLocale] === 'string' && map[defaultLocale].length > 0) {
            return map[defaultLocale];
        }
        // Last-resort: any non-empty entry, then page slugify.
        const anyEntry = Object.values(map).find(v => typeof v === 'string' && v.length > 0);
        if (anyEntry) return anyEntry;
        return slugifyAnchor(page);
    }
    if (typeof slug === 'string' && slug.length > 0) return slug;
    return slugifyAnchor(page);
}

/**
 * Loose normalisation for slug-chain *comparison*. Used by the resolver
 * so existing prod URLs keep working when their generation rules differ
 * from `slugifyAnchor` (the live skyclimber.pro had pages titled with
 * trailing whitespace + diacritics; the URL preserved both via legacy
 * `encodeURIComponent(name.replace(/\s+/g,'-').toLowerCase())`, which
 * doesn't match `slugifyAnchor`'s strip-diacritics + trim output).
 *
 * Normalisation rules (applied to BOTH sides of the comparison):
 *   - decodeURIComponent (URL-encoded diacritics → raw)
 *   - lowercase
 *   - NFKD + strip combining marks (`ā` → `a`)
 *   - whitespace → `-`
 *   - collapse repeated `-`
 *   - strip leading/trailing `-`
 *
 * The output is for COMPARISON only, never stored or rendered.
 */
export function normalizeSlugForMatch(input: string): string {
    let s: string;
    try {
        s = decodeURIComponent(input);
    } catch {
        s = input;
    }
    return s
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

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
            // Hard block: certain page names collide with built-in routes
            // (`/admin`) or QA fixtures (`/test`). Enforced server-side as
            // the source of truth — the admin form has the same check, but
            // we don't trust the client to be the only gate.
            assertNotReservedPageSlug(newNavigation?.page);
            const result = await this.navigationDB.insertOne(newNavigation);
            return result.insertedId?.toString() || '';
        } catch (err) {
            log.error({scope: 'navigation.create', err, page: newNavigation?.page}, 'createNavigation failed');
            await this.setupClient();
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async updateNavigation(page: string, sections: string[], editedBy?: string): Promise<string> {
        try {
            // `updateNavigation` upserts on `{type, page}` — without this
            // guard a caller could create `/admin` via the upsert path
            // even though `createNavigation` blocks it.
            assertNotReservedPageSlug(page);
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
            log.error({scope: 'navigation.update', err, page}, 'updateNavigation failed');
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
            log.error({scope: 'navigation.collection', err}, 'getNavigationCollection failed');
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
            return ordered.map(doc => {
                // Defensive: sections written by older code paths or a
                // misbehaving agent can arrive with content: null.  Coerce to
                // an empty array so no caller ever needs to guard against null,
                // and log the bad doc so it can be repaired in Mongo.
                if ((doc as any).content == null) {
                    log.error(
                        { scope: 'navigation.sections', sectionId: (doc as any).id },
                        'section.content is null — corrupt document in Sections collection',
                    );
                    (doc as any).content = [];
                }
                return doc as unknown as ISection;
            });
        } catch (err) {
            log.error({scope: 'navigation.sections', err}, 'getSections failed');
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
            log.error({scope: 'section.addUpdate', err, sectionId: item.section?.id}, 'addUpdateSectionItem failed');
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
            log.error({scope: 'section.remove', err, sectionId}, 'removeSectionItem failed');
            await this.setupClient();
            return JSON.stringify({error: String((err as Error).message || err)});
        }
    }

    async replaceUpdateNavigation(oldPageName: string, navigation: INavigation, editedBy?: string): Promise<string> {
        try {
            // Block renames into a reserved slug too — otherwise an editor
            // can sidestep the create-time guard by creating "foo" and
            // renaming it to "admin".
            assertNotReservedPageSlug(navigation?.page);
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
            log.error({scope: 'navigation.replace', err, oldPageName, newPage: navigation?.page}, 'replaceUpdateNavigation failed');
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
            log.error({scope: 'navigation.delete', err, pageName}, 'deleteNavigationItem failed');
            await this.setupClient();
            return '';
        }
    }

    async addUpdateNavigationItem(pageName: string, sections?: string[], editedBy?: string): Promise<string> {
        try {
            // See `createNavigation` — same reserved-slug block on the
            // upsert path so callers that create through this method
            // (rather than `createNavigation`) can't slip a `/admin`
            // page in.
            assertNotReservedPageSlug(pageName);
            const audit = auditStamp(editedBy);
            const existing = await this.navigationDB.findOne({type: 'navigation', page: pageName});
            if (!existing) {
                // F1 — backfill `slug` on first save. `slug` is the
                // explicit URL segment (separate from display name) and
                // never auto-updates on rename per design.
                const newSlug = slugifyAnchor(pageName);
                // F1 — uniqueness scoped to parent. New page is root
                // (no parent yet) so it conflicts with any other root
                // sharing the slug.
                await this.assertSlugUniqueAtParent(newSlug, undefined, undefined);
                const navigationItem: INavigation & {editedAt?: string; editedBy?: string} = {
                    id: guid(),
                    type: 'navigation',
                    page: pageName,
                    slug: newSlug,
                    seo: {},
                    sections: sections ?? [],
                    ...audit,
                };
                const result = await this.navigationDB.insertOne(navigationItem);
                return JSON.stringify(result);
            }
            // F1 — backfill `slug` on legacy rows that pre-date the
            // field. Never overwrite an existing slug (decision: rename
            // does not change URL silently).
            const update: any = sections ? {sections, ...audit} : {...audit};
            const existingSlug = (existing as any).slug as string | undefined;
            if (!existingSlug) {
                const newSlug = slugifyAnchor(pageName);
                await this.assertSlugUniqueAtParent(
                    newSlug,
                    (existing as any).parent as string | undefined,
                    (existing as any).id as string | undefined,
                );
                update.slug = newSlug;
            }
            const result = await this.navigationDB.findOneAndUpdate(
                {type: 'navigation', page: pageName},
                {$set: update}
            );
            return JSON.stringify(result);
        } catch (err) {
            const msg = String((err as Error).message || err);
            // F1 — slug-conflict is an expected validation error; surface
            // it so the admin layer can translate to a user-visible
            // message instead of swallowing as a generic failure.
            if (msg === 'slug-conflict') {
                return JSON.stringify({error: msg});
            }
            log.error({scope: 'navigation.addUpdate', err, pageName}, 'addUpdateNavigationItem failed');
            await this.setupClient();
            return '';
        }
    }

    /**
     * F1 sub-pages — set or clear a page's parent. `parentId === null`
     * promotes the page to a root. Server-side enforces:
     *   - both ids exist
     *   - no cycle (`parentId` chain must not include `pageId`)
     *   - resulting depth ≤ `MAX_PAGE_DEPTH`
     *
     * Throws `Error('not-found' | 'cycle' | 'depth-cap')` so callers
     * (admin UI + MCP) can map to user-facing copy. The mongoDB
     * connection wrapper serialises the error message into the
     * mutation response.
     */
    async setParent(pageId: string, parentId: string | null, editedBy?: string): Promise<string> {
        try {
            const page = await this.navigationDB.findOne({type: 'navigation', id: pageId});
            if (!page) throw new Error('not-found');

            if (parentId !== null) {
                if (parentId === pageId) throw new Error('cycle');
                // Walk the proposed parent chain. If we hit `pageId`
                // anywhere we'd form a cycle. We also count depth as we
                // walk so the depth-cap check is a single pass.
                let cursor: any = await this.navigationDB.findOne({type: 'navigation', id: parentId});
                if (!cursor) throw new Error('not-found');

                // depth contributed by the parent chain (parent itself
                // = 1, its parent = 2, …). Resulting page depth is
                // `parentDepth + 1`.
                let parentDepth = 1;
                let walker: any = cursor;
                const seen = new Set<string>([parentId]);
                while (walker?.parent) {
                    if (walker.parent === pageId) throw new Error('cycle');
                    if (seen.has(walker.parent)) throw new Error('cycle');
                    seen.add(walker.parent);
                    walker = await this.navigationDB.findOne({type: 'navigation', id: walker.parent});
                    if (!walker) break;
                    parentDepth += 1;
                }
                if (parentDepth + 1 > MAX_PAGE_DEPTH) throw new Error('depth-cap');
            }

            // F1 — slug uniqueness scoped to (new) parent. Sibling
            // collision means two children of the same parent would
            // resolve to the same `/parent/slug` URL.
            const pageSlug = (page as any).slug as string | undefined;
            if (pageSlug) {
                await this.assertSlugUniqueAtParent(pageSlug, parentId ?? undefined, pageId);
            }

            const audit = auditStamp(editedBy);
            const existingVersion = (page as any).version as number | undefined;
            const version = nextVersion(existingVersion);
            const update: any = {version, ...audit};
            if (parentId === null) {
                await this.navigationDB.updateOne(
                    {type: 'navigation', id: pageId},
                    {$set: update, $unset: {parent: ''}} as any,
                );
            } else {
                update.parent = parentId;
                await this.navigationDB.updateOne(
                    {type: 'navigation', id: pageId},
                    {$set: update},
                );
            }
            return JSON.stringify({setParent: {id: pageId, parent: parentId, version}});
        } catch (err) {
            const msg = String((err as Error).message || err);
            // Validation errors are expected — surface as-is, no reconnect.
            if (msg === 'not-found' || msg === 'cycle' || msg === 'depth-cap' || msg === 'slug-conflict') {
                return JSON.stringify({error: msg});
            }
            log.error({scope: 'navigation.setParent', err, pageId, parentId}, 'setParent failed');
            await this.setupClient();
            return JSON.stringify({error: msg});
        }
    }

    /**
     * F1 sub-pages — resolve a public URL slug-chain to a Navigation row.
     *
     * Walks the chain root-first: for `['services', 'cleaning']` finds a
     * root page (parent undefined) with `slug='services'`, then a child
     * of that page with `slug='cleaning'`. Returns `null` on any miss.
     *
     * Single-segment chains keep working unchanged — `['home']` resolves
     * to a root page with `slug='home'` exactly as before. Legacy rows
     * without a `slug` field fall back to `slugifyAnchor(page)` so
     * existing single-level URLs survive the upgrade window.
     */
    async findPageBySlugChain(chain: string[], locale?: string, defaultLocale?: string): Promise<INavigation | null> {
        if (!Array.isArray(chain) || chain.length === 0) return null;
        try {
            let parentId: string | undefined = undefined;
            let current: any = null;
            for (const segment of chain) {
                const candidates = await this.navigationDB.find({
                    type: 'navigation',
                    ...(parentId === undefined
                        ? {$or: [{parent: {$exists: false}}, {parent: null}, {parent: undefined}]}
                        : {parent: parentId}),
                }).toArray();
                // Match by explicit slug if present; fall back to
                // slugified `page` for legacy rows. Case-insensitive
                // segment compare for resilience to URL casing drift.
                // Per-locale slug (F1 follow-up): `slug` may be a
                // Record<locale, slug>; resolveSlug picks the right
                // entry with the documented fallback chain.
                // Compare in NORMALISED form (see `normalizeSlugForMatch`)
                // so live URLs generated by older slug logic — preserving
                // diacritics + trailing dashes from trailing whitespace —
                // still resolve. Stored slugs are unchanged; this only
                // affects how the resolver compares incoming URL segments
                // against the page's resolved slug.
                const seg = normalizeSlugForMatch(segment);
                const match = candidates.find((doc: any) => {
                    const docSlug = resolveSlug(doc.slug, doc.page as string, locale, defaultLocale);
                    return normalizeSlugForMatch(docSlug) === seg;
                });
                if (!match) return null;
                current = match;
                parentId = (match as any).id as string;
            }
            return current ? (current as unknown as INavigation) : null;
        } catch (err) {
            log.error({scope: 'navigation.findPageBySlugChain', err, chain, locale}, 'findPageBySlugChain failed');
            await this.setupClient();
            return null;
        }
    }

    /**
     * F1 follow-up — pick the URL slug for `page` in `locale`. Mirrors
     * `resolveSlug` in `slugChain.ts` so server- and client-side
     * resolution stay in lock-step. Public so admin / SDK callers can
     * reuse the same fallback chain.
     */
    slugForLocale(page: INavigation, locale: string, defaultLocale: string): string {
        return resolveSlug(page.slug as any, page.page, locale, defaultLocale);
    }

    /**
     * F1 — slug uniqueness scoped to parent. A slug must be unique
     * among siblings (same `parent`); two children of different parents
     * can share a slug. `excludeId` lets the caller skip the row being
     * updated (so re-saving a page does not trip on its own slug).
     *
     * Throws `Error('slug-conflict')` on collision so callers can map
     * to user-facing copy.
     */
    private async assertSlugUniqueAtParent(slug: string, parentId: string | undefined, excludeId: string | undefined): Promise<void> {
        if (!slug) return;
        const filter: any = {
            type: 'navigation',
            slug,
            ...(parentId === undefined
                ? {$or: [{parent: {$exists: false}}, {parent: null}, {parent: undefined}]}
                : {parent: parentId}),
        };
        const conflicts = await this.navigationDB.find(filter).toArray();
        const collision = conflicts.find((doc: any) => (doc.id as string | undefined) !== excludeId);
        if (collision) throw new Error('slug-conflict');
    }
}
