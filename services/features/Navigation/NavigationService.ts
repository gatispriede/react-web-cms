import {Collection} from 'mongodb';
import guid from "@utils/guid";
import {INavigation} from "@interfaces/INavigation";
import {ISection} from "@interfaces/ISection";
import {InSection} from "@interfaces/IMongo";
import {INavigationService} from "@services/infra/mongoConfig";
import {validateSectionInput} from "@utils/contentSchemas";
import {normalizeSectionInput} from "./normalizeSectionInput";
import {assertNotReservedPageSlug} from "@utils/reservedSlugs";
import {auditStamp} from "@services/features/Audit/audit";
import {nextVersion, requireVersion} from "@services/infra/conflict";
import {log} from "@services/infra/logger";
import {slugifyAnchor} from "@utils/stringFunctions";
import {normalizeSlugForMatch} from "@utils/slug";
import type {RedirectsService} from "@services/features/Seo/RedirectsService";

/**
 * Phase 0b — depth cap lifted to a soft warning.
 *
 * Real product taxonomies need 4–6 levels (e.g. cars → make → model →
 * trim → year), so the previous hard cap of 3 blocked legitimate trees.
 * `setParent` no longer throws on deep chains; instead, when the resulting
 * page depth exceeds `SOFT_DEPTH_WARNING_AT`, a `PAGE_DEPTH_DEEP` log
 * line is emitted so operators can spot pathological cases.
 *
 * Cycle prevention is unchanged (still a hard reject in `setParent`).
 *
 * Tune this if your taxonomy genuinely needs deeper trees — the value is
 * UX hygiene, not a correctness invariant.
 */
const SOFT_DEPTH_WARNING_AT = 8;

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

// `normalizeSlugForMatch` lives in `@utils/slug` (F7 — single source of
// truth). Re-exported here so existing imports against this module keep
// resolving (admin / SDK callers).
export {normalizeSlugForMatch};

export class NavigationService implements INavigationService{
    private navigationDB: Collection;
    private sectionsDB: Collection;
    private setupClient: () => Promise<void>;
    private redirectsService?: RedirectsService;

    constructor(navigationDB: Collection, sectionsDB: Collection, setupClient: () => Promise<void>) {
        this.navigationDB = navigationDB;
        this.sectionsDB = sectionsDB;
        this.setupClient = setupClient;
    }

    /**
     * W8h SEO polish — wire the redirects service post-construction so a
     * slug rename auto-writes a 301. Optional; if absent the rename still
     * works, we just don't drop a redirect row. Stays additive: callers
     * that don't know about the redirects feature aren't forced to.
     */
    public attachRedirectsService(svc: RedirectsService | undefined): void {
        this.redirectsService = svc;
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
        // Normalize per-content-type input drift before validation —
        // older bundles + MCP-driven authoring sometimes ship legacy
        // field names (INFRA_TOPOLOGY's svg/caption → topologySvg/
        // topologyCaption). Run before validate so the validator sees
        // the canonical shape; legacy keys are preserved on the way
        // through. mcp-rollout-aftermath #11.
        item = {...item, section: normalizeSectionInput(item.section)};
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
                // mcp-rollout-aftermath #1 — actually upsert when an
                // unknown id is provided AND a pageName is given. Lets
                // MCP callers write semantic ids ("cv-sec-mcp-hero")
                // instead of UUIDs. Without pageName we'd insert an
                // orphan section the navigation tree never references.
                if (!item.pageName) {
                    return JSON.stringify({error: `Section ${item.section.id} not found (and no pageName given to attach a fresh insert to)`});
                }
                const newSection = {...item.section, version: 1, ...audit};
                await this.sectionsDB.insertOne(newSection);
                const nav = await this.navigationDB.findOne({type: 'navigation', page: item.pageName});
                if (nav) {
                    const sections: string[] = Array.isArray((nav as any).sections) ? (nav as any).sections : [];
                    if (!sections.includes(item.section.id!)) sections.push(item.section.id!);
                    await this.navigationDB.updateOne(
                        {type: 'navigation', page: item.pageName},
                        {$set: {sections, ...audit}}
                    );
                }
                return JSON.stringify({createSection: {id: item.section.id, version: 1, upserted: true}});
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
            // System-managed sections (Phase 0a — `ISection.locked`) refuse
            // delete. Content edits stay allowed; only structural removal is
            // blocked. Source-of-truth check here covers GraphQL, MCP, REST,
            // and bundle-import paths since they all funnel through this
            // method. Reason string (literal or i18n key) is surfaced so the
            // admin layer can render a meaningful tooltip / toast.
            const existing = await this.sectionsDB.findOne({id: sectionId}) as ({locked?: boolean; lockReason?: string} | null);
            if (existing?.locked === true) {
                return JSON.stringify({
                    error: 'SECTION_LOCKED',
                    code: 'SECTION_LOCKED',
                    sectionId,
                    message: existing.lockReason ?? 'section.locked.default',
                });
            }
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
            // W8h SEO polish — capture the pre-rename slug so we can drop
            // an auto-301 if it changes. Read once before any update so
            // the read happens against the un-mutated row.
            const existingDoc = navigation?.id
                ? await this.navigationDB.findOne({type: 'navigation', id: navigation.id})
                : null;
            const oldSlug = (existingDoc as any)?.slug as string | Record<string, string> | undefined;
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
            // W8h SEO polish — slug changed: write a 301 from the old
            // public path to the new. Idempotent — `RedirectsService.create`
            // throws when an entry for `from` already exists; we swallow
            // that so a stale redirect can't block a legitimate rename.
            // Any other error is logged but never bubbled — a missing
            // redirect is a soft regression, not a publish blocker.
            await this.maybeAutoRedirectOnSlugChange(oldSlug, navigation, editedBy);
            return JSON.stringify(result);
        } catch (err) {
            log.error({scope: 'navigation.replace', err, oldPageName, newPage: navigation?.page}, 'replaceUpdateNavigation failed');
            await this.setupClient();
            return 'Error while fetching navigation data';
        }
    }

    private async maybeAutoRedirectOnSlugChange(
        oldSlugRaw: string | Record<string, string> | undefined,
        navigation: INavigation,
        editedBy?: string,
    ): Promise<void> {
        if (!this.redirectsService) return;
        try {
            const oldSlug = typeof oldSlugRaw === 'string'
                ? oldSlugRaw
                : (oldSlugRaw && typeof oldSlugRaw === 'object' ? Object.values(oldSlugRaw).find(v => typeof v === 'string' && v.length > 0) : undefined);
            const newSlugRaw = navigation?.slug as string | Record<string, string> | undefined;
            const newSlug = typeof newSlugRaw === 'string'
                ? newSlugRaw
                : (newSlugRaw && typeof newSlugRaw === 'object' ? Object.values(newSlugRaw).find(v => typeof v === 'string' && v.length > 0) : undefined);
            if (!oldSlug || !newSlug || oldSlug === newSlug) return;
            const from = `/${oldSlug}`;
            const to = `/${newSlug}`;
            await this.redirectsService.create(
                {from, to, code: 301, note: `Auto-created on page rename (${navigation.page})`},
                editedBy,
            );
            log.info({scope: 'navigation.autoRedirect', from, to, page: navigation.page}, 'auto-301 written on slug change');
        } catch (err) {
            const msg = String((err as Error)?.message ?? err);
            // `redirect already exists for …` — idempotent path, expected.
            if (msg.startsWith('redirect already exists')) return;
            log.error({scope: 'navigation.autoRedirect', err, page: navigation?.page}, 'auto-redirect on rename failed (swallowed)');
        }
    }

    /**
     * Phase 1.C-c — list every Navigation row produced by the warehouse
     * sync worker for a given adapter. `source === 'product'` is the
     * canonical discriminator; the `adapterId` filter is best-effort —
     * older rows pre-dating multi-adapter support lack the field, so we
     * include them when `adapterId` is omitted.
     */
    async listDerivedPages(adapterId?: string): Promise<INavigation[]> {
        try {
            const filter: any = {type: 'navigation', source: 'product'};
            if (adapterId) {
                filter.$or = [{adapterId}, {adapterId: {$exists: false}}];
            }
            const docs = await this.navigationDB.find(filter).toArray();
            return docs.map(d => d as unknown as INavigation);
        } catch (err) {
            log.error({scope: 'navigation.listDerivedPages', err, adapterId}, 'listDerivedPages failed');
            await this.setupClient();
            return [];
        }
    }

    /**
     * Phase 1.C-c — insert a fresh derived page row. Writes the section
     * rows first (so they have stable ids the nav row can reference),
     * then the nav row itself. Returns the new nav id on success, empty
     * string on failure.
     */
    async createDerivedPage(input: {
        page: string;
        slug: string;
        seo?: any;
        source: 'product' | 'system-page';
        productId?: string;
        systemKey?: string;
        adapterId?: string;
        sections: ISection[];
    }, editedBy?: string): Promise<string> {
        try {
            assertNotReservedPageSlug(input.page);
            const sectionRows = input.sections.map(s => ({...s, id: s.id ?? guid(), version: 1}));
            if (sectionRows.length > 0) {
                await this.sectionsDB.insertMany(sectionRows as any[]);
            }
            const navId = guid();
            const audit = auditStamp(editedBy);
            const doc: any = {
                id: navId,
                type: 'navigation',
                page: input.page,
                slug: input.slug,
                seo: input.seo ?? {},
                sections: sectionRows.map(s => s.id),
                source: input.source,
                ...(input.productId ? {productId: input.productId} : {}),
                ...(input.systemKey ? {systemKey: input.systemKey} : {}),
                ...(input.adapterId ? {adapterId: input.adapterId} : {}),
                ...audit,
            };
            await this.navigationDB.insertOne(doc);
            return navId;
        } catch (err) {
            log.error({scope: 'navigation.createDerivedPage', err, slug: input?.slug}, 'createDerivedPage failed');
            await this.setupClient();
            return '';
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
                // Phase 0b — soft-warn instead of throw. Lets product
                // taxonomies (4–6 levels) work without operator surgery.
                const resultingDepth = parentDepth + 1;
                if (resultingDepth > SOFT_DEPTH_WARNING_AT) {
                    log.warn(
                        {
                            scope: 'navigation.setParent',
                            code: 'PAGE_DEPTH_DEEP',
                            pageId,
                            parentDepth: resultingDepth,
                            threshold: SOFT_DEPTH_WARNING_AT,
                        },
                        'page nested deeper than soft-warning threshold (no hard cap)',
                    );
                }
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
            // Phase 0b — `'depth-cap'` retained in the allowlist for back-compat
            // (older bundles / tests may still assert against it). It is no
            // longer emitted from this method.
            if (msg === 'not-found' || msg === 'cycle' || msg === 'depth-cap' || msg === 'slug-conflict') {
                return JSON.stringify({error: msg});
            }
            log.error({scope: 'navigation.setParent', err, pageId, parentId}, 'setParent failed');
            await this.setupClient();
            return JSON.stringify({error: msg});
        }
    }

    /**
     * F8 — set the order of children under a parent (or root). Writes a
     * numeric `order` field on each row matching its index in
     * `orderedIds`. Rows passed in `orderedIds` that don't currently sit
     * under `parentId` are skipped (defensive — the caller should
     * never include them, but a stale UI race could). Bumps each row's
     * version so optimistic-concurrency callers see the change.
     *
     * Returns the count of rows actually updated.
     */
    async reorderPages(parentId: string | null, orderedIds: string[], editedBy?: string): Promise<string> {
        try {
            if (!Array.isArray(orderedIds)) throw new Error('orderedIds-required');
            const filter: any = {
                type: 'navigation',
                ...(parentId === null
                    ? {$or: [{parent: {$exists: false}}, {parent: null}]}
                    : {parent: parentId}),
            };
            const live = await this.navigationDB.find(filter).toArray();
            const liveIds = new Set(live.map((d: any) => d.id as string));
            let updated = 0;
            const audit = auditStamp(editedBy);
            for (let i = 0; i < orderedIds.length; i++) {
                const id = orderedIds[i];
                if (!liveIds.has(id)) continue;
                const row = live.find((d: any) => d.id === id) as any;
                const version = nextVersion(row?.version as number | undefined);
                const res = await this.navigationDB.updateOne(
                    {type: 'navigation', id},
                    {$set: {order: i, version, ...audit}},
                );
                updated += res.modifiedCount ?? 0;
            }
            return JSON.stringify({reorderPages: {parentId, updated}});
        } catch (err) {
            log.error({scope: 'navigation.reorder', err, parentId}, 'reorderPages failed');
            await this.setupClient();
            return JSON.stringify({error: String((err as Error).message || err)});
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
