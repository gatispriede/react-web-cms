/**
 * ModuleUsageService — answers "where is this module type used?" so the
 * `module.listTypes { includeUsage }` MCP tool and the admin Modules tab
 * can mark zero-usage types and link straight to the pages where a type
 * lives.
 *
 * Why a service: the admin Modules tab and the MCP tool both want the
 * same per-EItemType counts; the join over (Sections × pages) is awkward
 * to redo per consumer. Pure-function scanner keeps the math testable.
 *
 * Folder note: `services/features/Modules/` did not exist prior to this
 * scanner — there is no ModuleService today. We omit `feature.manifest.ts`
 * because the auto-registry only picks up folders that need a loader; this
 * scanner is consumed directly by the MCP `module.listTypes` tool.
 */

export interface ModuleSectionInput {
    /** Page name the section belongs to. Optional — sections without a page are dropped. */
    page?: string;
    /** Items inside the section. Each item carries an EItemType. */
    content?: Array<{type?: string}>;
}

export interface ModuleUsage {
    /** EItemType value — `HERO`, `GALLERY`, `RICH_TEXT`, etc. */
    type: string;
    /** Total instances across all sections / pages. */
    usageCount: number;
    /** Distinct page names where this type appears, sorted. */
    pages: string[];
}

/**
 * Returns one entry per type in `args.types` (so callers can render
 * `usageCount=0` rows alongside used ones in a single sweep).
 */
export function scanModuleUsage(args: {
    types: readonly string[];
    sections: readonly ModuleSectionInput[];
}): ModuleUsage[] {
    const out = new Map<string, {count: number; pages: Set<string>}>();
    for (const t of args.types) {
        out.set(t, {count: 0, pages: new Set<string>()});
    }
    for (const sec of args.sections) {
        const page = sec.page;
        for (const item of sec.content ?? []) {
            const t = item?.type;
            if (typeof t !== 'string') continue;
            const entry = out.get(t);
            if (!entry) continue; // unknown type — skip rather than synthesise a row
            entry.count++;
            if (typeof page === 'string' && page.length > 0) entry.pages.add(page);
        }
    }
    return args.types.map(t => {
        const entry = out.get(t)!;
        return {
            type: t,
            usageCount: entry.count,
            pages: [...entry.pages].sort(),
        };
    });
}

export interface ModuleUsageConnection {
    getNavigationCollection(): Promise<Array<{page: string; sections?: string[]}>>;
    getSections(args: {ids: string[]}): Promise<Array<{id?: string; page?: string; content?: Array<{type?: string}>}>>;
}

export interface ModuleUsageSources {
    sections: ModuleSectionInput[];
}

/**
 * Walks pages → section ids → section docs and back-fills the per-section
 * `page` from the navigation graph (sections themselves don't always carry
 * `page`). Caller supplies the type list (typically the EItemType enum
 * values).
 */
export async function loadModuleUsageSources(conn: ModuleUsageConnection): Promise<ModuleUsageSources> {
    const pages = await conn.getNavigationCollection();
    const idToPage = new Map<string, string>();
    const allIds: string[] = [];
    for (const p of pages) {
        for (const id of p.sections ?? []) {
            idToPage.set(id, p.page);
            allIds.push(id);
        }
    }
    if (allIds.length === 0) return {sections: []};
    const docs = await conn.getSections({ids: allIds});
    return {
        sections: docs.map(d => ({
            page: d.page ?? (d.id ? idToPage.get(d.id) : undefined),
            content: d.content,
        })),
    };
}
