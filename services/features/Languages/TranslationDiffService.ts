/**
 * TranslationDiffService — per-language coverage analysis against the
 * default-language baseline. Powers `i18n.listLanguages { includeMissing }`
 * and the `i18n.diff` MCP tool.
 *
 * Why a service: the same arithmetic is needed by
 *   - the MCP `i18n.diff` tool (agent: "what's missing in lv?")
 *   - the admin "translations" dashboard (per-locale coverage bar)
 *   - the bundle-export pre-flight ("don't ship if lv < 90 %")
 * — and there is exactly one source of truth (the default-language map).
 *
 * Pure functions only — no Mongo, no FileManager. The thin
 * `loadTranslationDiffSources` adapter does the IO so tests can inject
 * hand-rolled fixtures.
 */

export interface TranslationLanguageInput {
    symbol: string;
    default?: boolean;
    translations?: Record<string, string>;
}

export interface TranslationDiff {
    /** ISO-639 / locale tag — e.g. `lv`, `en`. */
    symbol: string;
    isDefault: boolean;
    /** 0–100, % of default-language keys present (and non-empty) in this lang. */
    coverage: number;
    /** Keys in default but absent or empty in this lang. */
    missingKeys: string[];
    /** Keys in this lang but not in default (rare; usually leftover after a default-lang prune). */
    extraKeys: string[];
}

export interface PairwiseDiff {
    onlyInA: string[];
    onlyInB: string[];
    differingValues: Array<{key: string; a: string; b: string}>;
}

/**
 * Pick the default language from the input array. Falls back to the first
 * one when no row is flagged `default: true`. Returns `null` when the
 * input is empty.
 */
function pickDefault(languages: readonly TranslationLanguageInput[]): TranslationLanguageInput | null {
    if (!languages.length) return null;
    return languages.find(l => l.default === true) ?? languages[0]!;
}

function nonEmptyKeys(map: Record<string, string> | undefined): Set<string> {
    const out = new Set<string>();
    if (!map) return out;
    for (const [k, v] of Object.entries(map)) {
        if (typeof v === 'string' && v.length > 0) out.add(k);
    }
    return out;
}

/**
 * For each language, compute coverage against the default language. The
 * default-language entry is included with `coverage: 100` and empty missing/
 * extra arrays so callers can render a single uniform table.
 */
export function diffLanguagesAgainstDefault(
    languages: readonly TranslationLanguageInput[],
): TranslationDiff[] {
    const def = pickDefault(languages);
    const defaultSymbol = def?.symbol ?? '';
    const defaultKeys = nonEmptyKeys(def?.translations);
    const defaultKeySet = new Set(defaultKeys);

    return languages.map(lang => {
        const isDefault = lang.symbol === defaultSymbol;
        const langKeys = nonEmptyKeys(lang.translations);
        if (isDefault) {
            return {
                symbol: lang.symbol,
                isDefault: true,
                coverage: 100,
                missingKeys: [],
                extraKeys: [],
            };
        }
        const missingKeys: string[] = [];
        for (const k of defaultKeySet) {
            if (!langKeys.has(k)) missingKeys.push(k);
        }
        const extraKeys: string[] = [];
        for (const k of langKeys) {
            if (!defaultKeySet.has(k)) extraKeys.push(k);
        }
        const total = defaultKeySet.size;
        const present = total - missingKeys.length;
        const coverage = total === 0 ? 100 : Math.round((present / total) * 100);
        return {
            symbol: lang.symbol,
            isDefault: false,
            coverage,
            missingKeys: missingKeys.sort(),
            extraKeys: extraKeys.sort(),
        };
    });
}

/**
 * Pairwise diff between two arbitrary language maps. Used by the
 * `i18n.diff` tool when the caller wants to compare two non-default
 * locales (e.g. `lv` vs `ru`) without re-routing through the baseline.
 */
export function diffPair(
    a: {translations?: Record<string, string>},
    b: {translations?: Record<string, string>},
): PairwiseDiff {
    const aMap = a.translations ?? {};
    const bMap = b.translations ?? {};
    const aKeys = new Set(Object.keys(aMap));
    const bKeys = new Set(Object.keys(bMap));
    const onlyInA: string[] = [];
    const onlyInB: string[] = [];
    const differingValues: Array<{key: string; a: string; b: string}> = [];
    for (const k of aKeys) {
        if (!bKeys.has(k)) {
            onlyInA.push(k);
            continue;
        }
        if (aMap[k] !== bMap[k]) {
            differingValues.push({key: k, a: aMap[k] ?? '', b: bMap[k] ?? ''});
        }
    }
    for (const k of bKeys) {
        if (!aKeys.has(k)) onlyInB.push(k);
    }
    return {
        onlyInA: onlyInA.sort(),
        onlyInB: onlyInB.sort(),
        differingValues: differingValues.sort((x, y) => x.key.localeCompare(y.key)),
    };
}

/**
 * Convenience adapter — fetches every language via `LanguageService.getLanguages()`.
 * The MCP tool uses this; tests call the pure functions directly.
 */
export interface TranslationDiffConnection {
    getLanguages(): Promise<Array<{symbol: string; default?: boolean; translations?: Record<string, string>}>>;
}

export async function loadTranslationDiffSources(conn: TranslationDiffConnection): Promise<TranslationLanguageInput[]> {
    const languages = await conn.getLanguages();
    return languages.map(l => ({
        symbol: l.symbol,
        default: l.default,
        translations: l.translations,
    }));
}
