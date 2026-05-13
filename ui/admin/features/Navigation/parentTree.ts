import {INavigation} from "@interfaces/INavigation";

/**
 * Pure helpers for the F1 sub-pages parent/child tree.
 *
 * Lives in `features/Navigation/` so the admin sider, the AddNew dialog,
 * and the Move-page action all share one source of truth for "is X a
 * descendant of Y" — keeps client-side cycle prevention consistent.
 *
 * Server (`NavigationService.setParent`) still validates independently;
 * this file is UX polish.
 */

export interface ITreeNode extends INavigation {
    children: ITreeNode[];
}

/** Build a parent → children tree. Items with a missing/invalid parent
 *  ref are surfaced as roots so orphans never disappear from the sider. */
export function buildTree(items: INavigation[]): ITreeNode[] {
    const byId = new Map<string, ITreeNode>();
    for (const it of items) byId.set(it.id, {...it, children: []});
    const roots: ITreeNode[] = [];
    for (const node of byId.values()) {
        if (node.parent && byId.has(node.parent)) {
            byId.get(node.parent)!.children.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
}

/** Walks parent → root. Returns `[]` for an unknown id. */
export function ancestorIds(items: INavigation[], id: string): string[] {
    const byId = new Map(items.map(i => [i.id, i] as const));
    const out: string[] = [];
    let cur = byId.get(id)?.parent;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
        seen.add(cur);
        out.push(cur);
        cur = byId.get(cur)?.parent;
    }
    return out;
}

/** Returns true when `candidate` is `target` itself, or sits anywhere
 *  beneath `target` in the tree. Used by the Parent Select to disable
 *  invalid options (would create a cycle). */
export function isDescendantOrSelf(
    items: INavigation[],
    targetId: string,
    candidateId: string,
): boolean {
    if (targetId === candidateId) return true;
    // Walk candidate's ancestors — if `target` is among them, candidate
    // is a descendant of target.
    return ancestorIds(items, candidateId).includes(targetId);
}

/** Depth from root. Root = 0. Used for the soft depth-warning UX hint. */
export function depthOf(items: INavigation[], id: string): number {
    return ancestorIds(items, id).length;
}

/**
 * Phase 0b — lifted from 2 (= 3-level hard cap) to 8 to match the
 * server-side `SOFT_DEPTH_WARNING_AT` constant. The number is a UX
 * threshold, not a correctness invariant; deeper trees still work, the
 * admin just stops surfacing "Add child" suggestions past this depth.
 */
export const MAX_DEPTH = 8;
