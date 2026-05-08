import type {InSection} from '@interfaces/IMongo';

/**
 * Per-content-type normalization run from `addUpdateSectionItem`
 * before persistence. The point is to be forgiving on input shape
 * variance — older bundles, MCP-driven authoring, manual edits all
 * produce slightly different field names that should round-trip into
 * the canonical shape rather than silently break the renderer.
 *
 * Wave 1 architecture decision D (2026-05-07): normalization lives in
 * its own file rather than inside NavigationService.ts so the service
 * stays under the 400-line ceiling and the rule set is testable in
 * isolation.
 *
 * Currently handles INFRA_TOPOLOGY (the case mcp-rollout-aftermath #11
 * surfaced — `cv-sec-cms-infra` and `cv-sec-lss-infra` were authored
 * with `svg` / `caption` but the renderer expects `topologySvg` /
 * `topologyCaption`). The renamed fields take precedence when both
 * are present; legacy keys are preserved on the way out so any other
 * consumer that reads them still sees something.
 *
 * Add new content types here as their drift surfaces. Each rule:
 *   - reads the parsed JSON
 *   - applies its rename / coercion
 *   - returns the (possibly mutated) JSON
 */

interface ContentItemLike {
    type?: string;
    content?: string;
    [k: string]: unknown;
}

interface SectionLike {
    content?: ContentItemLike[];
    [k: string]: unknown;
}

const INFRA_TOPOLOGY_RENAMES: Array<[string, string]> = [
    ['svg', 'topologySvg'],
    ['caption', 'topologyCaption'],
];

/**
 * Normalize one item's parsed content based on its `type`. Returns the
 * (possibly modified) parsed object. Pure function — caller stringifies.
 */
export function normalizeItemContent(itemType: string | undefined, parsed: Record<string, unknown>): Record<string, unknown> {
    if (!parsed || typeof parsed !== 'object') return parsed;

    if (itemType === 'INFRA_TOPOLOGY') {
        const out = {...parsed};
        for (const [legacy, canonical] of INFRA_TOPOLOGY_RENAMES) {
            // Prefer the canonical key; fall back to legacy. If neither
            // exists, leave alone — INFRA_TOPOLOGY without an SVG is a
            // valid in-progress state.
            if (out[canonical] === undefined && out[legacy] !== undefined) {
                out[canonical] = out[legacy];
            }
        }
        return out;
    }

    return parsed;
}

/**
 * Normalize a full section payload. Walks each item, parses its
 * `content` JSON, applies content-type-specific rules, re-serializes.
 *
 * Tolerant of malformed JSON — a parse error skips that item rather
 * than rejecting the whole section. Authoring is the wrong place to
 * enforce strict-JSON semantics; that lives in `validateSectionInput`.
 */
export function normalizeSectionInput(section: InSection): InSection {
    if (!section || !Array.isArray(section.content)) return section;
    const next = (section.content as unknown as ContentItemLike[]).map(item => {
        if (!item || typeof item.content !== 'string') return item;
        try {
            const parsed = JSON.parse(item.content);
            const normalized = normalizeItemContent(item.type, parsed);
            // Only re-serialize when the rule actually changed
            // something — avoids spurious JSON.stringify round-trips
            // for the >99 % of items the rules don't touch.
            return normalized !== parsed
                ? {...item, content: JSON.stringify(normalized)}
                : item;
        } catch {
            return item;
        }
    });
    return {...section, content: next as unknown as InSection['content']};
}
