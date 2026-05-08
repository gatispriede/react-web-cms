/**
 * ThemeUsageService — answers "which themes are active or have ever been
 * active" so cleanup tools can surface unused presets / customs.
 *
 * Why a service: the same join is needed by the MCP `theme.list
 * { includeUsage }` tool and the admin "Themes" tab's unused-filter.
 *
 * Pure function only — no IO. The adapter is intentionally thin and
 * delegates to existing service methods.
 *
 * Limitation: published-snapshot history (`PublishService.getHistory()`)
 * does NOT currently store the active theme id at the time of publish, so
 * `publishHistoryThemeIds` is supplied empty by the adapter today. The
 * shape is preserved so a future schema bump (snapshot.themeId) plugs in
 * without changing call sites.
 */

export interface ThemeUsageInput {
    id: string;
    name: string;
}

export interface ThemeUsage {
    id: string;
    name: string;
    /** Matches the result of `themeService.getActive().id`. */
    isActive: boolean;
    /** True iff this theme appears in any historical publish snapshot. */
    inPublishHistory: boolean;
}

export function scanThemeUsage(args: {
    themes: readonly ThemeUsageInput[];
    activeId: string | null;
    publishHistoryThemeIds: readonly string[];
}): ThemeUsage[] {
    const historySet = new Set(args.publishHistoryThemeIds);
    return args.themes.map(t => ({
        id: t.id,
        name: t.name,
        isActive: t.id === args.activeId,
        inPublishHistory: historySet.has(t.id),
    }));
}

export interface ThemeUsageConnection {
    getThemes(): Promise<Array<{id: string; name: string}>>;
    /** Some loaders expose `getActiveTheme`, others `getActive`; both shapes accepted. */
    getActiveTheme?(): Promise<{id: string} | null>;
    getActive?(): Promise<{id: string} | null>;
}

export interface ThemeUsageSources {
    themes: ThemeUsageInput[];
    activeId: string | null;
    publishHistoryThemeIds: string[];
}

export async function loadThemeUsageSources(conn: ThemeUsageConnection): Promise<ThemeUsageSources> {
    const themes = await conn.getThemes();
    const getActive = conn.getActiveTheme ?? conn.getActive;
    const active = getActive ? await getActive.call(conn) : null;
    return {
        themes: themes.map(t => ({id: t.id, name: t.name})),
        activeId: active?.id ?? null,
        // PublishedSnapshots do not carry the active-theme id today; see
        // service header. Returning [] keeps the shape stable.
        publishHistoryThemeIds: [],
    };
}
